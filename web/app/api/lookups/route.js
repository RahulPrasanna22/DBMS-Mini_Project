import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { dbErrorResponse } from "@/lib/dberror";

// Dropdown data for filters and forms
export async function GET() {
  const { session, error } = await requireRole();
  if (error) return error;

  try {
    const categories = await query(
      "SELECT category_id, name FROM categories ORDER BY name"
    );
    const suppliers =
      session.role === "SUPPLIER"
        ? await query(
            "SELECT supplier_id, name, active FROM suppliers WHERE supplier_id = $1",
            [session.supplier_id]
          )
        : await query("SELECT supplier_id, name, active FROM suppliers ORDER BY name");

    return NextResponse.json({
      categories: categories.rows,
      suppliers: suppliers.rows,
    });
  } catch (e) {
    return dbErrorResponse(e);
  }
}