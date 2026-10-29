import { NextResponse } from "next/server";
import { pool, query } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { dbErrorResponse } from "@/lib/dberror";

const STATUSES = ["ORDERED", "RECEIVED", "CANCELLED"];

// GET /api/purchase-orders?status=
// JOIN + GROUP BY: one row per PO with item count and total value
export async function GET(request) {
  const { session, error } = await requireRole();
  if (error) return error;

  const status = request.nextUrl.searchParams.get("status");
  const params = [];
  const where = [];

  if (STATUSES.includes(status)) {
    params.push(status);
    where.push(`po.status = $${params.length}`);
  }

  // A SUPPLIER only sees their own purchase orders
  if (session.role === "SUPPLIER") {
    if (!session.supplier_id) {
      return NextResponse.json({ error: "Supplier account has no supplier" }, { status: 403 });
    }
    params.push(session.supplier_id);
    where.push(`po.supplier_id = $${params.length}`);
  }

  try {
    const result = await query(
      `SELECT po.po_id, po.status,
              to_char(po.order_date, 'YYYY-MM-DD')    AS order_date,
              to_char(po.expected_date, 'YYYY-MM-DD') AS expected_date,
              to_char(po.received_date, 'YYYY-MM-DD') AS received_date,
              s.name AS supplier, w.name AS warehouse,
              COUNT(i.product_id) AS item_count,
              COALESCE(SUM(i.quantity * i.unit_cost), 0) AS total_value
       FROM purchase_orders po
       JOIN suppliers  s ON s.supplier_id  = po.supplier_id
       JOIN warehouses w ON w.warehouse_id = po.warehouse_id
       LEFT JOIN po_items i ON i.po_id = po.po_id
       ${where.length ? "WHERE " + where.join(" AND ") : ""}
       GROUP BY po.po_id, s.name, w.name
       ORDER BY po.po_id DESC`,
      params
    );
    return NextResponse.json(result.rows);
  } catch (e) {
    return dbErrorResponse(e);
  }
}

// POST /api/purchase-orders
// The PO and all its items are inserted in ONE transaction on ONE pool client:
// if any item fails (duplicate product, quantity <= 0, ...), everything rolls back.
export async function POST(request) {
  const { session, error } = await requireRole("ADMIN", "MANAGER");
  if (error) return error;

  const b = await request.json().catch(() => ({}));
  const num = (x) => (x === "" || x == null ? null : Number(x));
  const items = Array.isArray(b.items) ? b.items : [];

  if (items.length === 0) {
    return NextResponse.json({ error: "Add at least one item" }, { status: 400 });
  }

  const client = await pool.connect(); // a dedicated connection for the transaction
  try {
    await client.query("BEGIN");

    const po = await client.query(
      `INSERT INTO purchase_orders
         (supplier_id, warehouse_id, created_by, status, order_date, expected_date)
       VALUES ($1, $2, $3, 'ORDERED', CURRENT_DATE, $4)
       RETURNING po_id`,
      [num(b.supplier_id), num(b.warehouse_id), session.user_id, b.expected_date || null]
    );
    const poId = po.rows[0].po_id;

    for (const it of items) {
      await client.query(
        `INSERT INTO po_items (po_id, product_id, quantity, unit_cost)
         VALUES ($1, $2, $3, $4)`,
        [poId, num(it.product_id), num(it.quantity), num(it.unit_cost)]
      );
    }

    await client.query("COMMIT");
    return NextResponse.json({ po_id: poId }, { status: 201 });
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    return dbErrorResponse(e);
  } finally {
    client.release(); // always hand the connection back to the pool
  }
}