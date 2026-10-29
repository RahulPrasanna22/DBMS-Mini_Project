import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { dbErrorResponse } from "@/lib/dberror";

const val = (x) => (x === undefined || x === "" ? null : x);

// GET: all suppliers with their product count (LEFT JOIN + GROUP BY)
export async function GET() {
  const { error } = await requireRole("ADMIN");
  if (error) return error;

  try {
    const result = await query(
      `SELECT s.supplier_id, s.name, s.email, s.phone, s.city, s.rating, s.active,
              COUNT(p.product_id)::int AS product_count
       FROM suppliers s
       LEFT JOIN products p ON p.supplier_id = s.supplier_id
       GROUP BY s.supplier_id
       ORDER BY s.name`
    );
    return NextResponse.json(result.rows);
  } catch (e) {
    return dbErrorResponse(e);
  }
}

// POST: add a supplier. Email format, unique email and rating 0-5 are checked by the database.
export async function POST(request) {
  const { error } = await requireRole("ADMIN");
  if (error) return error;

  const b = await request.json().catch(() => ({}));

  try {
    const result = await query(
      `INSERT INTO suppliers (name, email, phone, city, rating, active)
       VALUES ($1, $2, $3, $4, COALESCE($5::numeric, 0), true)
       RETURNING supplier_id, name`,
      [val(b.name), val(b.email), val(b.phone), val(b.city), val(b.rating)]
    );
    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (e) {
    return dbErrorResponse(e);
  }
}