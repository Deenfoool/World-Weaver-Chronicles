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

const gameSavePayloadSchema = z.object({
  player: z.any(),
  currentLocationId: z.string(),
  currentWeather: z.string(),
  weatherDuration: z.number(),
  quests: z.array(z.any()),
  status: z.string(),
  timestamp: z.number(),
  settings: z.object({
    language: z.enum(["en", "ru"]),
  }),
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // put application routes here
  // prefix all routes with /api

  // use storage to perform CRUD operations on the storage interface
  // e.g. storage.insertUser(user) or storage.getUserByUsername(username)
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
