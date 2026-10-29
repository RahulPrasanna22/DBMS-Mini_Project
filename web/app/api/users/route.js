import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { query } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { dbErrorResponse } from "@/lib/dberror";

const val = (x) => (x === undefined || x === "" ? null : x);

// GET: users with their supplier name. password_hash is never selected.
export async function GET() {
  const { error } = await requireRole("ADMIN");
  if (error) return error;

  try {
    const result = await query(
      `SELECT u.user_id, u.username, u.role, u.supplier_id,
              s.name AS supplier, u.created_at
       FROM users u
       LEFT JOIN suppliers s ON s.supplier_id = u.supplier_id
       ORDER BY u.user_id`
    );
    return NextResponse.json(result.rows);
  } catch (e) {
    return dbErrorResponse(e);
  }
}

// POST: create a user. The password is hashed with bcrypt before it is stored.
// The database CHECK constraints reject a bad role, and a SUPPLIER without a
// supplier_id (or any other role with one).
export async function POST(request) {
  const { error } = await requireRole("ADMIN");
  if (error) return error;

  const b = await request.json().catch(() => ({}));

  if (!b.username || !b.password || !b.role) {
    return NextResponse.json(
      { error: "Username, password and role are required" },
      { status: 400 }
    );
  }
  if (String(b.password).length < 6) {
    return NextResponse.json(
      { error: "Password must be at least 6 characters" },
      { status: 400 }
    );
  }

  const hash = await bcrypt.hash(String(b.password), 10);

  try {
    const result = await query(
      `INSERT INTO users (username, password_hash, role, supplier_id)
       VALUES ($1, $2, $3, $4)
       RETURNING user_id, username, role, supplier_id`,
      [b.username, hash, b.role, val(b.supplier_id)]
    );
    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (e) {
    return dbErrorResponse(e);
  }
}