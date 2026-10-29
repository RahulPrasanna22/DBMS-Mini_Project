import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { dbErrorResponse } from "@/lib/dberror";

// GET: one PO with its line items
export async function GET(request, { params }) {
  const { session, error } = await requireRole();
  if (error) return error;

  const id = Number((await params).id);
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: "Invalid purchase order id" }, { status: 400 });
  }

  try {
    const poRes = await query(
      `SELECT po.po_id, po.status, po.supplier_id, s.name AS supplier,
              po.warehouse_id, w.name AS warehouse, u.username AS created_by,
              to_char(po.order_date, 'YYYY-MM-DD')    AS order_date,
              to_char(po.expected_date, 'YYYY-MM-DD') AS expected_date,
              to_char(po.received_date, 'YYYY-MM-DD') AS received_date
       FROM purchase_orders po
       JOIN suppliers  s ON s.supplier_id  = po.supplier_id
       JOIN warehouses w ON w.warehouse_id = po.warehouse_id
       LEFT JOIN users u ON u.user_id      = po.created_by
       WHERE po.po_id = $1`,
      [id]
    );
    const po = poRes.rows[0];

    // A supplier asking for someone else's PO gets the same 404 as a missing one
    if (
      !po ||
      (session.role === "SUPPLIER" &&
        Number(po.supplier_id) !== Number(session.supplier_id))
    ) {
      return NextResponse.json({ error: "Purchase order not found" }, { status: 404 });
    }

    const itemsRes = await query(
      `SELECT i.product_id, p.sku, p.name, i.quantity, i.unit_cost,
              i.quantity * i.unit_cost AS line_total
       FROM po_items i
       JOIN products p ON p.product_id = i.product_id
       WHERE i.po_id = $1
       ORDER BY p.name`,
      [id]
    );

    return NextResponse.json({ po, items: itemsRes.rows });
  } catch (e) {
    return dbErrorResponse(e);
  }
}