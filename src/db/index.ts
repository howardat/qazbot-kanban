import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as { sql?: ReturnType<typeof postgres> };

// prepare: false keeps it compatible with pooled connections (Neon, PgBouncer).
// Production uses Supabase's session pooler: its transaction pooler (port 6543) hangs when postgres.js runs
// many queries at once, which froze pages until they timed out. In session mode each connection holds a
// pooler slot, so keep few per server instance and close idle ones.
const sql = globalForDb.sql ?? postgres(process.env.DATABASE_URL!, { prepare: false, max: 3, idle_timeout: 20, connect_timeout: 10 });
if (process.env.NODE_ENV !== "production") globalForDb.sql = sql;

export const db = drizzle(sql, { schema });
