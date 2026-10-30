import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as { pool?: Pool };

// node-postgres, not postgres.js: through Supabase's transaction pooler (port 6543) postgres.js splits each
// parameterized query into two round trips and pipelines queries, and under parallel load the pooler hands
// the halves to different backends. Queries then hang forever or return another query's rows. node-postgres
// sends each query whole, one at a time per connection. The session pooler is no way out: it caps clients
// at its pool size (15), which serverless instances use up.
const pool = globalForDb.pool ?? new Pool({ connectionString: process.env.DATABASE_URL!, max: 5, idleTimeoutMillis: 10_000, connectionTimeoutMillis: 10_000 });
if (process.env.NODE_ENV !== "production") globalForDb.pool = pool;

export const db = drizzle(pool, { schema });
