import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { dbErrorResponse } from "@/lib/dberror";

const val = (x) => (x === undefined || x === "" ? null : x);

export async function PATCH(request, { params }) {
  const { error } = await requireRole("ADMIN");
  if (error) return error;

  const id = Number((await params).id);
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: "Invalid warehouse id" }, { status: 400 });
  }

  const b = await request.json().catch(() => ({}));

  try {
    const result = await query(
      `UPDATE warehouses SET
         name     = COALESCE($1, name),
         city     = COALESCE($2, city),
         capacity = COALESCE($3, capacity)
       WHERE warehouse_id = $4
       RETURNING warehouse_id, name, capacity`,
      [val(b.name), val(b.city), val(b.capacity), id]
    );
    if (result.rowCount === 0) {
      return NextResponse.json({ error: "Warehouse not found" }, { status: 404 });
    }
    return NextResponse.json(result.rows[0]);
  } catch (e) {
    return dbErrorResponse(e);
  }
}