import { type User, type InsertUser } from "@shared/schema";
import { gameSaves, users } from "@shared/schema";
import { randomUUID } from "crypto";
import { db, hasDatabase } from "./db";
import { eq } from "drizzle-orm";

// modify the interface with any CRUD methods
// you might need

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getGameSave(userId: string): Promise<unknown | undefined>;
  upsertGameSave(userId: string, data: unknown): Promise<void>;
  deleteGameSave(userId: string): Promise<void>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private gameSaveByUserId: Map<string, unknown>;

  constructor() {
    this.users = new Map();
    this.gameSaveByUserId = new Map();
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async getGameSave(userId: string): Promise<unknown | undefined> {
    return this.gameSaveByUserId.get(userId);
  }

  async upsertGameSave(userId: string, data: unknown): Promise<void> {
    this.gameSaveByUserId.set(userId, data);
  }

  async deleteGameSave(userId: string): Promise<void> {
    this.gameSaveByUserId.delete(userId);
  }
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    if (!db) return undefined;
    const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    if (!db) return undefined;
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.username, username))
      .limit(1);
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    if (!db) {
      throw new Error("Database is not configured");
    }

    const [created] = await db.insert(users).values(insertUser).returning();
    return created;
  }

  async getGameSave(userId: string): Promise<unknown | undefined> {
    if (!db) return undefined;
    const [save] = await db
      .select({ data: gameSaves.data })
      .from(gameSaves)
      .where(eq(gameSaves.userId, userId))
      .limit(1);

    return save?.data;
  }

  async upsertGameSave(userId: string, data: unknown): Promise<void> {
    if (!db) return;

    await db
      .insert(gameSaves)
      .values({ userId, data })
      .onConflictDoUpdate({
        target: gameSaves.userId,
        set: { data, updatedAt: new Date() },
      });
  }

  async deleteGameSave(userId: string): Promise<void> {
    if (!db) return;

    await db.delete(gameSaves).where(eq(gameSaves.userId, userId));
  }
}

export const storage: IStorage = hasDatabase ? new DatabaseStorage() : new MemStorage();
