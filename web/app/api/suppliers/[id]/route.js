import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { dbErrorResponse } from "@/lib/dberror";

const val = (x) => (x === undefined || x === "" ? null : x);

// PATCH: edit a supplier, or deactivate / reactivate it with { active: false | true }.
// Fields that are missing or blank keep their current value (COALESCE).
export async function PATCH(request, { params }) {
  const { error } = await requireRole("ADMIN");
  if (error) return error;

  const id = Number((await params).id);
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: "Invalid supplier id" }, { status: 400 });
  }

  const b = await request.json().catch(() => ({}));

  try {
    const result = await query(
      `UPDATE suppliers SET
         name   = COALESCE($1, name),
         email  = COALESCE($2, email),
         phone  = COALESCE($3, phone),
         city   = COALESCE($4, city),
         rating = COALESCE($5::numeric, rating),
         active = COALESCE($6::boolean, active)
       WHERE supplier_id = $7
       RETURNING supplier_id, name, active`,
      [val(b.name), val(b.email), val(b.phone), val(b.city), val(b.rating), val(b.active), id]
    );
    if (result.rowCount === 0) {
      return NextResponse.json({ error: "Supplier not found" }, { status: 404 });
    }
    return NextResponse.json(result.rows[0]);
  } catch (e) {
    return dbErrorResponse(e);
  }
}