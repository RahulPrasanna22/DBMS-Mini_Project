import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { dbErrorResponse } from "@/lib/dberror";

// Dropdown data for filters and forms
export async function GET() {
  const { session, error } = await requireRole();
  if (error) return error;

  const isSupplier = session.role === "SUPPLIER";

  try {
    const categories = await query(
      "SELECT category_id, name FROM categories ORDER BY name"
    );
    const suppliers = isSupplier
      ? await query(
          "SELECT supplier_id, name, active FROM suppliers WHERE supplier_id = $1",
          [session.supplier_id]
        )
      : await query("SELECT supplier_id, name, active FROM suppliers ORDER BY name");

    // Warehouses and the full product list are for staff only
    const warehouses = isSupplier
      ? { rows: [] }
      : await query(
          "SELECT warehouse_id, name, city, capacity FROM warehouses ORDER BY name"
        );
    const products = isSupplier
      ? { rows: [] }
        : await query(
          "SELECT product_id, sku, name, unit_price, supplier_id FROM products ORDER BY name"
        );

    return NextResponse.json({
      categories: categories.rows,
      suppliers: suppliers.rows,
      warehouses: warehouses.rows,
      products: products.rows,
    });
  } catch (e) {
    return dbErrorResponse(e);
  }
}