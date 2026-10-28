import { Pool } from "pg";

// Reuse one pool across hot reloads in dev
const pool =
  globalThis.pgPool ?? new Pool({ connectionString: process.env.DATABASE_URL });
if (process.env.NODE_ENV !== "production") globalThis.pgPool = pool;

export { pool };

// Parameterised queries only: query("SELECT * FROM products WHERE product_id = $1", [id])
export function query(text, params) {
  return pool.query(text, params);
}