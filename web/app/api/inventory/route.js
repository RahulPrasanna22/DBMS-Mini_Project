import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { dbErrorResponse } from "@/lib/dberror";

// GET /api/inventory?warehouse=   stock by warehouse and product (JOIN of 3 tables)
export async function GET(request) {
  const { error } = await requireRole("ADMIN", "MANAGER");
  if (error) return error;

  const warehouse = Number(request.nextUrl.searchParams.get("warehouse"));
  const params = [];
  let where = "";
  if (Number.isInteger(warehouse) && warehouse > 0) {
    params.push(warehouse);
    where = "WHERE i.warehouse_id = $1";
  }

  try {
    const result = await query(
      `SELECT i.warehouse_id, w.name AS warehouse, w.city,
              i.product_id, p.sku, p.name AS product,
              i.quantity, p.reorder_level, i.updated_at
       FROM inventory i
       JOIN warehouses w ON w.warehouse_id = i.warehouse_id
       JOIN products   p ON p.product_id   = i.product_id
       ${where}
       ORDER BY w.name, p.name`,
      params
    );
    return NextResponse.json(result.rows);
  } catch (e) {
    return dbErrorResponse(e);
  }
}