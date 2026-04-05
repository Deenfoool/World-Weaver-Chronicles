import crypto from "crypto";
import type { Request, Response } from "express";

export type SessionUser = {
  id: string;
  username: string;
  isAdmin: boolean;
};

const SESSION_COOKIE_NAME = "wwc_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;
const DEFAULT_DEV_SECRET = "wwc_dev_secret_change_me";

function getAuthSecret(): string {
  return process.env.AUTH_SECRET || DEFAULT_DEV_SECRET;
}

function base64UrlEncode(input: string): string {
  return Buffer.from(input, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlDecode(input: string): string {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  return Buffer.from(padded, "base64").toString("utf8");
}

function signPayload(payload: string): string {
  const secret = getAuthSecret();
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

function parseCookieHeader(headerValue: string | undefined): Record<string, string> {
  if (!headerValue) return {};
  return headerValue
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce<Record<string, string>>((acc, part) => {
      const idx = part.indexOf("=");
      if (idx <= 0) return acc;
      const key = part.slice(0, idx).trim();
      const value = decodeURIComponent(part.slice(idx + 1).trim());
      acc[key] = value;
      return acc;
    }, {});
}

export function createSessionToken(user: SessionUser): string {
  const payload = base64UrlEncode(
    JSON.stringify({
      id: user.id,
      username: user.username,
      isAdmin: user.isAdmin,
      exp: Date.now() + SESSION_TTL_SECONDS * 1000,
    }),
  );
  const signature = signPayload(payload);
  return `${payload}.${signature}`;
}

export function readSessionUserFromRequest(req: Request): SessionUser | null {
  const cookies = parseCookieHeader(req.headers.cookie);
  const token = cookies[SESSION_COOKIE_NAME];
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = signPayload(payload);
  const expectedBuf = Buffer.from(expected, "utf8");
  const actualBuf = Buffer.from(signature, "utf8");
  if (expectedBuf.length !== actualBuf.length) return null;
  if (!crypto.timingSafeEqual(expectedBuf, actualBuf)) return null;
  try {
    const parsed = JSON.parse(base64UrlDecode(payload)) as {
      id?: string;
      username?: string;
      isAdmin?: boolean;
      exp?: number;
    };
    if (!parsed.id || !parsed.username || !Number.isFinite(parsed.exp)) return null;
    if (Date.now() > Number(parsed.exp)) return null;
    return {
      id: parsed.id,
      username: parsed.username,
      isAdmin: Boolean(parsed.isAdmin),
    };
  } catch (_e) {
    return null;
  }
}

export function setSessionCookie(res: Response, user: SessionUser) {
  const token = createSessionToken(user);
  const secure = process.env.NODE_ENV === "production";
  const cookie = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${SESSION_TTL_SECONDS}`,
    secure ? "Secure" : "",
  ]
    .filter(Boolean)
    .join("; ");
  res.setHeader("Set-Cookie", cookie);
}

export function clearSessionCookie(res: Response) {
  const secure = process.env.NODE_ENV === "production";
  const cookie = [
    `${SESSION_COOKIE_NAME}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
    secure ? "Secure" : "",
  ]
    .filter(Boolean)
    .join("; ");
  res.setHeader("Set-Cookie", cookie);
}
