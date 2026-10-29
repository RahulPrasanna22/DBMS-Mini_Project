import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { dbErrorResponse } from "@/lib/dberror";

// GET /api/dashboard?min=10
// Every query uses ($1::int IS NULL OR p.supplier_id = $1):
//   staff   -> $1 is NULL, so the filter is off and all rows are counted
//   supplier -> $1 is their supplier_id, so only their own data is counted
export async function GET(request) {
  const { session, error } = await requireRole();
  if (error) return error;

  const isSupplier = session.role === "SUPPLIER";
  if (isSupplier && !session.supplier_id) {
    return NextResponse.json({ error: "Supplier account has no supplier" }, { status: 403 });
  }
  const sid = isSupplier ? Number(session.supplier_id) : null;

  // N for the HAVING query (suppliers with more than N ordered units)
  const minRaw = Math.floor(Number(request.nextUrl.searchParams.get("min")));
  const minUnits = Number.isFinite(minRaw) && minRaw >= 0 ? minRaw : 10;

  try {
    const [totals, byCategory, utilisation, suppliers, neverOrdered, movements] =
      await Promise.all([
        // 1. Totals: scalar subqueries + the v_stock_summary view
        query(
          `SELECT
             (SELECT COUNT(*)::int FROM products p
               WHERE ($1::int IS NULL OR p.supplier_id = $1)) AS products,
             (SELECT COUNT(*)::int FROM warehouses) AS warehouses,
             (SELECT COALESCE(SUM(v.stock_value), 0)
                FROM v_stock_summary v
                JOIN products p ON p.product_id = v.product_id
               WHERE ($1::int IS NULL OR p.supplier_id = $1)) AS stock_value,
             (SELECT COUNT(*)::int FROM low_stock_alerts a
                JOIN products p ON p.product_id = a.product_id
               WHERE a.resolved = false
                 AND ($1::int IS NULL OR p.supplier_id = $1)) AS open_alerts`,
          [sid]
        ),

        // 2. Stock value per category: JOIN + GROUP BY + aggregate
        query(
          `SELECT v.category,
                  SUM(v.stock_value)       AS stock_value,
                  SUM(v.total_stock)::int  AS units
           FROM v_stock_summary v
           JOIN products p ON p.product_id = v.product_id
           WHERE ($1::int IS NULL OR p.supplier_id = $1)
           GROUP BY v.category
           ORDER BY stock_value DESC`,
          [sid]
        ),

        // 3. Warehouse utilisation = SUM(quantity) / capacity (staff only)
        isSupplier
          ? Promise.resolve({ rows: [] })
          : query(
              `SELECT w.warehouse_id, w.name, w.capacity,
                      COALESCE(SUM(i.quantity), 0)::int AS used,
                      ROUND(100.0 * COALESCE(SUM(i.quantity), 0) / w.capacity, 1)
                        AS utilisation_pct
               FROM warehouses w
               LEFT JOIN inventory i ON i.warehouse_id = w.warehouse_id
               GROUP BY w.warehouse_id, w.name, w.capacity
               ORDER BY utilisation_pct DESC`
            ),

        // 4. GROUP BY ... HAVING: suppliers with more than N ordered units
        query(
          `SELECT s.supplier_id, s.name,
                  SUM(i.quantity)::int         AS ordered_units,
                  COUNT(DISTINCT po.po_id)::int AS orders
           FROM suppliers s
           JOIN purchase_orders po ON po.supplier_id = s.supplier_id
           JOIN po_items i         ON i.po_id        = po.po_id
           WHERE po.status <> 'CANCELLED'
             AND ($1::int IS NULL OR s.supplier_id = $1)
           GROUP BY s.supplier_id, s.name
           HAVING SUM(i.quantity) > $2
           ORDER BY ordered_units DESC`,
          [sid, minUnits]
        ),

        // 5. Subquery: products that never appear in any purchase order
        query(
          `SELECT p.product_id, p.sku, p.name, c.name AS category
           FROM products p
           JOIN categories c ON c.category_id = p.category_id
           WHERE NOT EXISTS (
                   SELECT 1 FROM po_items i WHERE i.product_id = p.product_id
                 )
             AND ($1::int IS NULL OR p.supplier_id = $1)
           ORDER BY p.name`,
          [sid]
        ),

        // 6. Last 10 stock movements: ORDER BY created_at DESC
        query(
          `SELECT m.movement_id, p.sku, p.name AS product, w.name AS warehouse,
                  m.change_qty, m.movement_type, m.reference_id, m.created_at
           FROM stock_movements m
           JOIN products   p ON p.product_id   = m.product_id
           JOIN warehouses w ON w.warehouse_id = m.warehouse_id
           WHERE ($1::int IS NULL OR p.supplier_id = $1)
           ORDER BY m.created_at DESC, m.movement_id DESC
           LIMIT 10`,
          [sid]
        ),
      ]);

    return NextResponse.json({
      scope: isSupplier ? "supplier" : "staff",
      minUnits,
      totals: totals.rows[0],
      stockByCategory: byCategory.rows,
      warehouseUtilisation: utilisation.rows,
      suppliersOverN: suppliers.rows,
      neverOrdered: neverOrdered.rows,
      recentMovements: movements.rows,
    });
  } catch (e) {
    return dbErrorResponse(e);
  }
}