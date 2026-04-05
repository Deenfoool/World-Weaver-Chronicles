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
import crypto from "crypto";
import { insertUserSchema } from "@shared/schema";

const ADMIN_LOGIN = "deenfoool";
const ADMIN_PASSWORD = "12.06.2002ad";
const PASSWORD_HASH_PREFIX = "scrypt$";

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

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // put application routes here
  // prefix all routes with /api

  // use storage to perform CRUD operations on the storage interface
  // e.g. storage.insertUser(user) or storage.getUserByUsername(username)
  app.post("/api/auth/register", async (req, res) => {
    const parsed = authPayloadSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid registration payload", issues: parsed.error.issues });
    }

    const { username, password } = parsed.data;
    if (username.toLowerCase() === ADMIN_LOGIN.toLowerCase()) {
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

    return res.json({
      ok: true,
      user: {
        id: created.id,
        username: created.username,
        isAdmin: false,
      },
    });
  });

  app.post("/api/auth/login", async (req, res) => {
    const parsed = authPayloadSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid login payload", issues: parsed.error.issues });
    }

    const { username, password } = parsed.data;

    if (username === ADMIN_LOGIN && password === ADMIN_PASSWORD) {
      return res.json({
        ok: true,
        user: {
          id: "admin-deenfoool",
          username,
          isAdmin: true,
        },
      });
    }

    const user = await storage.getUserByUsername(username);
    if (!user || !verifyPassword(user.password, password)) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    return res.json({
      ok: true,
      user: {
        id: user.id,
        username: user.username,
        isAdmin: false,
      },
    });
  });

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
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

  app.get("/api/game/save/:userId", async (req, res) => {
    const { userId } = req.params;
    if (!userId) {
      return res.status(400).json({ message: "userId is required" });
    }

    const save = await storage.getGameSave(userId);
    if (!save) {
      return res.status(404).json({ message: "Save not found" });
    }

    return res.json(save);
  });

  app.put("/api/game/save/:userId", async (req, res) => {
    const { userId } = req.params;
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

  app.delete("/api/game/save/:userId", async (req, res) => {
    const { userId } = req.params;
    if (!userId) {
      return res.status(400).json({ message: "userId is required" });
    }

    await storage.deleteGameSave(userId);
    return res.json({ ok: true });
  });

  return httpServer;
}
