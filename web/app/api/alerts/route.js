import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { dbErrorResponse } from "@/lib/dberror";

// Open low-stock alerts, created automatically by the trg_low_stock trigger
export async function GET() {
  const { error } = await requireRole("ADMIN", "MANAGER");
  if (error) return error;

  try {
    const result = await query(
      `SELECT a.alert_id, a.product_id, p.sku, p.name AS product,
              a.warehouse_id, w.name AS warehouse,
              a.quantity, p.reorder_level, a.created_at
       FROM low_stock_alerts a
       JOIN products   p ON p.product_id   = a.product_id
       JOIN warehouses w ON w.warehouse_id = a.warehouse_id
       WHERE a.resolved = false
       ORDER BY a.created_at DESC`
    );
    return NextResponse.json(result.rows);
  } catch (e) {
    return dbErrorResponse(e);
  }
}