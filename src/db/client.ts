import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import fs from "node:fs";
import path from "node:path";

const dbPath = process.env.DATABASE_URL ?? "./data/promodevs.db";

// Garante que a pasta ./data existe antes do SQLite tentar criar o arquivo
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL"); // melhora concorrência entre o scraper e o dashboard lendo ao mesmo tempo

export const db = drizzle(sqlite, { schema });
