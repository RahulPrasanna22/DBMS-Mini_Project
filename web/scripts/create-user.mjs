// Usage (run from the web folder):
//   node --env-file=.env.local scripts/create-user.mjs --list
//   node --env-file=.env.local scripts/create-user.mjs <username> <password> <ADMIN|MANAGER|SUPPLIER> [supplier_id]
import pg from "pg";
import bcrypt from "bcryptjs";

const args = process.argv.slice(2);
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  if (args[0] === "--list") {
    const r = await pool.query(
      "SELECT user_id, username, role, supplier_id FROM users ORDER BY user_id"
    );
    console.table(r.rows);
    return;
  }

  const [username, password, role, supplierId] = args;
  if (!username || !password || !role) {
    console.log("Usage: create-user.mjs <username> <password> <ROLE> [supplier_id]");
    return;
  }

  const hash = await bcrypt.hash(password, 10); // never store the plain password

  // Insert a new user, or update the password/role if the username exists
  const r = await pool.query(
    `INSERT INTO users (username, password_hash, role, supplier_id)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (username) DO UPDATE
       SET password_hash = EXCLUDED.password_hash,
           role = EXCLUDED.role,
           supplier_id = EXCLUDED.supplier_id
     RETURNING user_id, username, role, supplier_id`,
    [username, hash, role.toUpperCase(), supplierId ? Number(supplierId) : null]
  );
  console.table(r.rows);
}

main()
  .catch((e) => console.error("Database error:", e.message))
  .finally(() => pool.end());