import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getDb } from "@/lib/mongodb";
import { requireRole } from "@/lib/auth";
import { dbErrorResponse } from "@/lib/dberror";

// GET: PostgreSQL row + stock per warehouse + MongoDB specs document, combined
export async function GET(request, { params }) {
  const { session, error } = await requireRole();
  if (error) return error;

  const id = Number((await params).id);
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: "Invalid product id" }, { status: 400 });
  }

  try {
    const [productRes, stockRes] = await Promise.all([
      query(
        `SELECT p.product_id, p.sku, p.name, p.description, p.unit_price, p.reorder_level,
                p.category_id, c.name AS category,
                p.supplier_id, s.name AS supplier
         FROM products p
         JOIN categories c ON c.category_id = p.category_id
         JOIN suppliers  s ON s.supplier_id = p.supplier_id
         WHERE p.product_id = $1`,
        [id]
      ),
      query(
        `SELECT w.warehouse_id, w.name AS warehouse, w.city, i.quantity, i.updated_at
         FROM inventory i
         JOIN warehouses w ON w.warehouse_id = i.warehouse_id
         WHERE i.product_id = $1
         ORDER BY w.name`,
        [id]
      ),
    ]);

    const product = productRes.rows[0];
    // A supplier asking for someone else's product gets the same 404 as a missing one
    if (
      !product ||
      (session.role === "SUPPLIER" &&
        Number(product.supplier_id) !== Number(session.supplier_id))
    ) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    // MongoDB part: if Atlas is unreachable the page still works, without specs
    let specs = null;
    let specsError = null;
    try {
      const db = await getDb();
      specs = await db
        .collection("product_specs")
        .findOne({ product_id: id }, { projection: { _id: 0 } });
    } catch (e) {
      specsError = e.message;
    }

    return NextResponse.json({ product, stock: stockRes.rows, specs, specsError });
  } catch (e) {
    return dbErrorResponse(e);
  }
}

// PATCH: blank or missing fields keep their current value (COALESCE)
export async function PATCH(request, { params }) {
  const { error } = await requireRole("ADMIN", "MANAGER");
  if (error) return error;

  const id = Number((await params).id);
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: "Invalid product id" }, { status: 400 });
  }

  const b = await request.json().catch(() => ({}));
  const val = (x) => (x === undefined || x === "" ? null : x);

  try {
    const result = await query(
      `UPDATE products SET
         sku           = COALESCE($1, sku),
         name          = COALESCE($2, name),
         description   = COALESCE($3, description),
         category_id   = COALESCE($4, category_id),
         supplier_id   = COALESCE($5, supplier_id),
         unit_price    = COALESCE($6, unit_price),
         reorder_level = COALESCE($7, reorder_level)
       WHERE product_id = $8
       RETURNING product_id, sku, name, unit_price, reorder_level`,
      [val(b.sku), val(b.name), val(b.description), val(b.category_id),
       val(b.supplier_id), val(b.unit_price), val(b.reorder_level), id]
    );
    if (result.rowCount === 0) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }
    return NextResponse.json(result.rows[0]);
  } catch (e) {
    return dbErrorResponse(e);
  }
}