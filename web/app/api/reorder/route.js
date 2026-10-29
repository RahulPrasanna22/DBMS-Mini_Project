import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { dbErrorResponse } from "@/lib/dberror";

// Reorder suggestions come straight from the v_reorder_suggestions view
export async function GET() {
  const { error } = await requireRole("ADMIN", "MANAGER");
  if (error) return error;

  try {
    const result = await query(
      `SELECT warehouse_id, warehouse, product_id, sku, name, quantity,
              reorder_level, suggested_order_qty, supplier_id, supplier
       FROM v_reorder_suggestions
       ORDER BY warehouse, name`
    );
    return NextResponse.json(result.rows);
  } catch (e) {
    return dbErrorResponse(e);
  }
}