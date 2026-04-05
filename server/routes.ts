import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import {
  ALL_QUESTS,
  CLASSES,
  ENEMIES,
  INITIAL_QUESTS,
  ITEMS,
  LOCATIONS,
  MERCHANTS,
  NPCS,
  RECIPES,
  SKILLS,
  WEATHER,
} from "@shared/game-content";
import type { SaveData } from "@shared/game-types";
import crypto from "crypto";
import { insertUserSchema } from "@shared/schema";
import {
  clearSessionCookie,
  readSessionUserFromRequest,
  setSessionCookie,
  type SessionUser,
} from "./auth";
import { applyServerGameAction } from "./game-actions";

const ADMIN_LOGIN = process.env.ADMIN_LOGIN || (process.env.NODE_ENV !== "production" ? "deenfoool" : "");
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || (process.env.NODE_ENV !== "production" ? "12.06.2002ad" : "");
const PASSWORD_HASH_PREFIX = "scrypt$";
const AUTH_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const AUTH_RATE_LIMIT_MAX_ATTEMPTS = 20;
const authRateLimiterState = new Map<string, { count: number; windowStartedAt: number }>();
const runtimeFlags: Record<string, boolean> = {
  economyEnabled: true,
  eventQuestsEnabled: true,
  combatEnabled: true,
};

declare global {
  namespace Express {
    interface Request {
      authUser?: SessionUser | null;
    }
  }
}

const authPayloadSchema = insertUserSchema.extend({
  username: z.string().min(3).max(32).regex(/^[A-Za-z0-9_.-]+$/),
  password: z.string().min(6).max(128),
});

function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${PASSWORD_HASH_PREFIX}${salt}$${hash}`;
}

function verifyPassword(stored: string, password: string) {
  if (!stored.startsWith(PASSWORD_HASH_PREFIX)) return stored === password;
  const parts = stored.split("$");
  if (parts.length !== 3) return false;
  const [, salt, expectedHash] = parts;
  const actualHash = crypto.scryptSync(password, salt, 64).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(expectedHash, "hex"), Buffer.from(actualHash, "hex"));
}

function applyAuthRateLimit(req: any, res: any): boolean {
  const ip = String(req.ip || req.headers["x-forwarded-for"] || "unknown");
  const key = `${ip}:${req.path}`;
  const now = Date.now();
  const bucket = authRateLimiterState.get(key);
  if (!bucket || now - bucket.windowStartedAt >= AUTH_RATE_LIMIT_WINDOW_MS) {
    authRateLimiterState.set(key, { count: 1, windowStartedAt: now });
    return true;
  }
  if (bucket.count >= AUTH_RATE_LIMIT_MAX_ATTEMPTS) {
    const retryAfter = Math.ceil((AUTH_RATE_LIMIT_WINDOW_MS - (now - bucket.windowStartedAt)) / 1000);
    res.setHeader("Retry-After", String(Math.max(1, retryAfter)));
    res.status(429).json({ message: "Too many auth attempts. Please retry later." });
    return false;
  }
  bucket.count += 1;
  authRateLimiterState.set(key, bucket);
  return true;
}

const gameSavePayloadSchema = z.object({
  player: z.any(),
  currentLocationId: z.string(),
  currentWeather: z.string(),
  weatherDuration: z.number(),
  quests: z.array(z.any()),
  codexUnlocks: z.object({
    items: z.array(z.string()).optional(),
    locations: z.array(z.string()).optional(),
    npcs: z.array(z.string()).optional(),
    enemies: z.array(z.string()).optional(),
  }).optional(),
  worldEconomy: z.object({
    tick: z.number().optional(),
    hubs: z.record(z.object({
      hubId: z.string().optional(),
      hubKind: z.string().optional(),
      wealth: z.number().optional(),
      level: z.number().optional(),
      treasury: z.number().optional(),
      tradeTurnover: z.number().optional(),
      resources: z.record(z.number()).optional(),
      supply: z.number().optional(),
      demand: z.number().optional(),
      stability: z.number().optional(),
      playerRelation: z.number().optional(),
      levelUpStreak: z.number().optional(),
      levelDownStreak: z.number().optional(),
      degradationStreak: z.number().optional(),
      destroyed: z.boolean().optional(),
      marketMode: z.string().optional(),
      blackMarketUntilTick: z.number().optional(),
    })).optional(),
    tradeRoutes: z.record(z.object({
      id: z.string().optional(),
      fromHubId: z.string().optional(),
      toHubId: z.string().optional(),
      distance: z.number().optional(),
      flow: z.number().optional(),
      risk: z.number().optional(),
    })).optional(),
    hubRelations: z.record(z.object({
      hubAId: z.string().optional(),
      hubBId: z.string().optional(),
      status: z.string().optional(),
      strength: z.number().optional(),
    })).optional(),
    spawnedHubIds: z.array(z.string()).optional(),
    events: z.array(z.object({
      id: z.string().optional(),
      tick: z.number().optional(),
      type: z.string().optional(),
      hubId: z.string().optional(),
      targetHubId: z.string().optional(),
      intensity: z.number().optional(),
    })).optional(),
  }).optional(),
  status: z.string(),
  timestamp: z.number(),
  settings: z.object({
    language: z.enum(["en", "ru"]),
    voice: z.object({
      lore: z.boolean().optional(),
      quests: z.boolean().optional(),
      npcDialogue: z.boolean().optional(),
    }).optional(),
    tutorial: z.object({
      enabled: z.boolean().optional(),
      completed: z.boolean().optional(),
      step: z.number().optional(),
      seenHints: z.array(z.string()).optional(),
    }).optional(),
  }).passthrough(),
}).passthrough();

const serverGameActionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("raid_caravan"),
    hubId: z.string().min(1),
    currentHubId: z.string().min(1).optional(),
  }),
  z.object({
    type: z.literal("invest_hub"),
    hubId: z.string().min(1),
    goldAmount: z.number().int().positive().max(1_000_000),
  }),
  z.object({
    type: z.literal("run_diplomacy"),
    hubId: z.string().min(1),
    currentHubId: z.string().min(1).optional(),
  }),
  z.object({
    type: z.literal("sabotage_hub"),
    hubId: z.string().min(1),
  }),
]);

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // put application routes here
  // prefix all routes with /api

  const requireAuth = (req: any, res: any, next: any) => {
    const authUser = readSessionUserFromRequest(req);
    if (!authUser) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    req.authUser = authUser;
    return next();
  };

  const requireAdmin = (req: any, res: any, next: any) => {
    const authUser = readSessionUserFromRequest(req);
    if (!authUser) return res.status(401).json({ message: "Unauthorized" });
    if (!authUser.isAdmin) return res.status(403).json({ message: "Forbidden" });
    req.authUser = authUser;
    return next();
  };

  const getRequestedUserId = (req: any): string => {
    return (req.params?.userId as string | undefined) || req.authUser?.id || "";
  };

  // use storage to perform CRUD operations on the storage interface
  // e.g. storage.insertUser(user) or storage.getUserByUsername(username)
  app.post("/api/auth/register", async (req, res) => {
    if (!applyAuthRateLimit(req, res)) return;
    const parsed = authPayloadSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid registration payload", issues: parsed.error.issues });
    }

    const { username, password } = parsed.data;
    if (ADMIN_LOGIN && username.toLowerCase() === ADMIN_LOGIN.toLowerCase()) {
      return res.status(409).json({ message: "Username is reserved" });
    }

    const existing = await storage.getUserByUsername(username);
    if (existing) {
      return res.status(409).json({ message: "Username already exists" });
    }

    const created = await storage.createUser({
      username,
      password: hashPassword(password),
    });

    const sessionUser: SessionUser = {
      id: created.id,
      username: created.username,
      isAdmin: false,
    };
    setSessionCookie(res, sessionUser);
    return res.json({
      ok: true,
      user: sessionUser,
    });
  });

  app.post("/api/auth/login", async (req, res) => {
    if (!applyAuthRateLimit(req, res)) return;
    const parsed = authPayloadSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid login payload", issues: parsed.error.issues });
    }

    const { username, password } = parsed.data;

    if (ADMIN_LOGIN && ADMIN_PASSWORD && username === ADMIN_LOGIN && password === ADMIN_PASSWORD) {
      const adminUser: SessionUser = {
        id: "admin-deenfoool",
        username,
        isAdmin: true,
      };
      setSessionCookie(res, adminUser);
      return res.json({
        ok: true,
        user: adminUser,
      });
    }

    const user = await storage.getUserByUsername(username);
    if (!user || !verifyPassword(user.password, password)) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const sessionUser: SessionUser = {
      id: user.id,
      username: user.username,
      isAdmin: false,
    };
    setSessionCookie(res, sessionUser);
    return res.json({
      ok: true,
      user: sessionUser,
    });
  });

  app.get("/api/auth/me", (req, res) => {
    const authUser = readSessionUserFromRequest(req);
    if (!authUser) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    setSessionCookie(res, authUser);
    return res.json({ ok: true, user: authUser });
  });

  app.post("/api/auth/logout", (_req, res) => {
    clearSessionCookie(res);
    return res.json({ ok: true });
  });

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.get("/api/admin/runtime", requireAdmin, (_req, res) => {
    return res.json({
      ok: true,
      runtimeFlags,
      telemetry: {
        authRateBuckets: authRateLimiterState.size,
      },
    });
  });

  app.put("/api/admin/runtime", requireAdmin, (req, res) => {
    const payload = req.body as { runtimeFlags?: Record<string, unknown> };
    const nextFlags = payload?.runtimeFlags || {};
    Object.keys(runtimeFlags).forEach((key) => {
      if (typeof nextFlags[key] === "boolean") runtimeFlags[key] = nextFlags[key] as boolean;
    });
    return res.json({ ok: true, runtimeFlags });
  });

  app.get("/api/game/content", (_req, res) => {
    res.json({
      weather: WEATHER,
      skills: SKILLS,
      recipes: RECIPES,
      items: ITEMS,
      enemies: ENEMIES,
      locations: LOCATIONS,
      initialQuests: INITIAL_QUESTS,
      merchants: MERCHANTS,
      npcs: NPCS,
      allQuests: ALL_QUESTS,
      classes: CLASSES,
    });
  });

  app.post("/api/game/action", requireAuth, async (req, res) => {
    const userId = req.authUser!.id;
    if (!userId) {
      return res.status(400).json({ message: "userId is required" });
    }

    const parsedAction = serverGameActionSchema.safeParse(req.body);
    if (!parsedAction.success) {
      return res.status(400).json({
        message: "Invalid game action payload",
        issues: parsedAction.error.issues,
      });
    }

    const currentSave = await storage.getGameSave(userId);
    if (!currentSave) {
      return res.status(404).json({ message: "Save not found" });
    }

    const parsedCurrentSave = gameSavePayloadSchema.safeParse(currentSave);
    if (!parsedCurrentSave.success) {
      return res.status(500).json({
        message: "Stored save has invalid shape",
        issues: parsedCurrentSave.error.issues,
      });
    }

    const nextSave = applyServerGameAction(parsedCurrentSave.data as unknown as SaveData, parsedAction.data);
    const parsedSave = gameSavePayloadSchema.safeParse(nextSave);
    if (!parsedSave.success) {
      return res.status(500).json({
        message: "Server action produced invalid save",
        issues: parsedSave.error.issues,
      });
    }

    await storage.upsertGameSave(userId, parsedSave.data);
    return res.json({
      ok: true,
      save: parsedSave.data,
    });
  });

  app.get("/api/game/save", requireAuth, async (req, res) => {
    const userId = req.authUser!.id;
    if (!userId) {
      return res.status(400).json({ message: "userId is required" });
    }

    const save = await storage.getGameSave(userId);
    if (!save) {
      return res.status(404).json({ message: "Save not found" });
    }

    return res.json(save);
  });

  app.put("/api/game/save", requireAuth, async (req, res) => {
    const userId = req.authUser!.id;
    if (!userId) {
      return res.status(400).json({ message: "userId is required" });
    }

    const parsed = gameSavePayloadSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        message: "Invalid save payload",
        issues: parsed.error.issues,
      });
    }

    await storage.upsertGameSave(userId, parsed.data);
    return res.json({ ok: true });
  });

  app.delete("/api/game/save", requireAuth, async (req, res) => {
    const userId = req.authUser!.id;
    if (!userId) {
      return res.status(400).json({ message: "userId is required" });
    }

    await storage.deleteGameSave(userId);
    return res.json({ ok: true });
  });

  // Legacy compatibility endpoints with explicit userId.
  app.get("/api/game/save/:userId", requireAuth, async (req, res) => {
    const requestedUserId = getRequestedUserId(req);
    if (!requestedUserId) {
      return res.status(400).json({ message: "userId is required" });
    }
    if (!req.authUser?.isAdmin && requestedUserId !== req.authUser?.id) {
      return res.status(403).json({ message: "Forbidden" });
    }
    const save = await storage.getGameSave(requestedUserId);
    if (!save) {
      return res.status(404).json({ message: "Save not found" });
    }
    return res.json(save);
  });

  app.put("/api/game/save/:userId", requireAuth, async (req, res) => {
    const requestedUserId = getRequestedUserId(req);
    if (!requestedUserId) {
      return res.status(400).json({ message: "userId is required" });
    }
    if (!req.authUser?.isAdmin && requestedUserId !== req.authUser?.id) {
      return res.status(403).json({ message: "Forbidden" });
    }
    const parsed = gameSavePayloadSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        message: "Invalid save payload",
        issues: parsed.error.issues,
      });
    }
    await storage.upsertGameSave(requestedUserId, parsed.data);
    return res.json({ ok: true });
  });

  app.delete("/api/game/save/:userId", requireAuth, async (req, res) => {
    const requestedUserId = getRequestedUserId(req);
    if (!requestedUserId) {
      return res.status(400).json({ message: "userId is required" });
    }
    if (!req.authUser?.isAdmin && requestedUserId !== req.authUser?.id) {
      return res.status(403).json({ message: "Forbidden" });
    }
    await storage.deleteGameSave(requestedUserId);
    return res.json({ ok: true });
  });

  return httpServer;
}
