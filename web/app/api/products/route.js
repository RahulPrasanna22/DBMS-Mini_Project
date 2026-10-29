import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { dbErrorResponse } from "@/lib/dberror";

// ORDER BY cannot use $1 placeholders, so only these whitelisted columns are allowed
const SORT_COLUMNS = {
  name: "p.name",
  sku: "p.sku",
  price: "p.unit_price",
  stock: "total_stock",
  category: "c.name",
  supplier: "s.name",
};

// GET /api/products?q=&category=&supplier=&sort=   (sort=-name means descending)
export async function GET(request) {
  const { session, error } = await requireRole();
  if (error) return error;

  const sp = request.nextUrl.searchParams;
  const q = (sp.get("q") || "").trim();
  const category = Number(sp.get("category"));
  const supplier = Number(sp.get("supplier"));
  const sort = sp.get("sort") || "";

  const params = [];
  const where = [];
  let rank = "0";

  // Full-text search on the GIN-indexed tsvector column, ranked by relevance
  if (q) {
    params.push(q);
    const n = params.length; // only a number goes into the SQL text, never user input
    where.push(`p.search @@ plainto_tsquery('english', $${n})`);
    rank = `ts_rank(p.search, plainto_tsquery('english', $${n}))`;
  }

  if (Number.isInteger(category) && category > 0) {
    params.push(category);
    where.push(`p.category_id = $${params.length}`);
  }

  // A SUPPLIER only ever sees their own products
  if (session.role === "SUPPLIER") {
    if (!session.supplier_id) {
      return NextResponse.json({ error: "Supplier account has no supplier" }, { status: 403 });
    }
    params.push(session.supplier_id);
    where.push(`p.supplier_id = $${params.length}`);
  } else if (Number.isInteger(supplier) && supplier > 0) {
    params.push(supplier);
    where.push(`p.supplier_id = $${params.length}`);
  }

  const desc = sort.startsWith("-");
  const key = desc ? sort.slice(1) : sort;
  let orderBy;
  if (Object.hasOwn(SORT_COLUMNS, key)) {
    orderBy = `${SORT_COLUMNS[key]} ${desc ? "DESC" : "ASC"}`;
  } else if (q) {
    orderBy = `${rank} DESC`; // best match first
  } else {
    orderBy = "p.name ASC";
  }

  const sql = `
    SELECT p.product_id, p.sku, p.name, p.unit_price, p.reorder_level,
           c.name AS category, s.name AS supplier,
           COALESCE(v.total_stock, 0) AS total_stock,
           ${rank} AS relevance
    FROM products p
    JOIN categories c ON c.category_id = p.category_id
    JOIN suppliers  s ON s.supplier_id = p.supplier_id
    LEFT JOIN v_stock_summary v ON v.product_id = p.product_id
    ${where.length ? "WHERE " + where.join(" AND ") : ""}
    ORDER BY ${orderBy}, p.product_id`;

  try {
    const result = await query(sql, params);
    return NextResponse.json(result.rows);
  } catch (e) {
    return dbErrorResponse(e);
  }
}

// POST /api/products   (ADMIN / MANAGER)
// No validation here on purpose: CHECK and UNIQUE constraints in PostgreSQL do it.
export async function POST(request) {
  const { error } = await requireRole("ADMIN", "MANAGER");
  if (error) return error;

  const b = await request.json().catch(() => ({}));

  try {
    const result = await query(
      `INSERT INTO products
         (sku, name, description, category_id, supplier_id, unit_price, reorder_level)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING product_id, sku, name`,
      [b.sku, b.name, b.description || null, b.category_id, b.supplier_id, b.unit_price, b.reorder_level]
    );
    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (e) {
    return dbErrorResponse(e);
  }
}