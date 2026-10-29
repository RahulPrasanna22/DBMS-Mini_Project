import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { dbErrorResponse } from "@/lib/dberror";

const val = (x) => (x === undefined || x === "" ? null : x);

// GET: warehouses with units currently stored (LEFT JOIN + GROUP BY + SUM)
export async function GET() {
  const { error } = await requireRole("ADMIN");
  if (error) return error;

  try {
    const result = await query(
      `SELECT w.warehouse_id, w.name, w.city, w.capacity,
              COALESCE(SUM(i.quantity), 0)::int AS used
       FROM warehouses w
       LEFT JOIN inventory i ON i.warehouse_id = w.warehouse_id
       GROUP BY w.warehouse_id
       ORDER BY w.name`
    );
    return NextResponse.json(result.rows);
  } catch (e) {
    return dbErrorResponse(e);
  }
}

// POST: unique name and capacity > 0 are enforced by the database
export async function POST(request) {
  const { error } = await requireRole("ADMIN");
  if (error) return error;

  const b = await request.json().catch(() => ({}));

  try {
    const result = await query(
      `INSERT INTO warehouses (name, city, capacity)
       VALUES ($1, $2, $3)
       RETURNING warehouse_id, name`,
      [val(b.name), val(b.city), val(b.capacity)]
    );
    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (e) {
    return dbErrorResponse(e);
  }
}