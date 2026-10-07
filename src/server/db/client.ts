import "server-only";
import { Pool } from "pg";
import { drizzle, type NodePgDatabase, type NodePgTransaction } from "drizzle-orm/node-postgres";
import type { ExtractTablesWithRelations } from "drizzle-orm";
import * as schema from "./schema";

// One pool per process. The connection string comes from DATABASE_URL (set in
// the server environment, never in the repo). The pool opens connections on
// first query, so importing this module does not touch the database.
// Max 10 connections: the host has 4 GB RAM and one Node process.

export type Db = NodePgDatabase<typeof schema>;

// What db.transaction()'s callback receives. The data-access layer accepts
// `DbOrTx` wherever a function may run either standalone or inside someone
// else's transaction (e.g. addChapter locking the story row).
export type Tx = NodePgTransaction<typeof schema, ExtractTablesWithRelations<typeof schema>>;
export type DbOrTx = Db | Tx;

declare global {
  // Kept on globalThis so dev hot reloads reuse the pool instead of opening a new one.
  var __hikoyaDb: Db | undefined;
}

function createDb(): Db {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }
  const pool = new Pool({ connectionString, max: 10, idleTimeoutMillis: 30_000 });
  return drizzle(pool, { schema });
}

export function getDb(): Db {
  if (!globalThis.__hikoyaDb) {
    globalThis.__hikoyaDb = createDb();
  }
  return globalThis.__hikoyaDb;
}
