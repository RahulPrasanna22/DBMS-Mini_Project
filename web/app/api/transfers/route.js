import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { dbErrorResponse } from "@/lib/dberror";

// POST /api/transfers  { product_id, from_warehouse, to_warehouse, quantity }
// The stored procedure does the real work in one transaction: it locks the rows,
// checks stock and capacity, and RAISEs an exception if anything is wrong.
export async function POST(request) {
  const { error } = await requireRole("ADMIN", "MANAGER");
  if (error) return error;

  const b = await request.json().catch(() => ({}));
  const toNum = (x) => (x === "" || x == null ? NaN : Number(x));
  const [product, from, to, qty] = [
    b.product_id,
    b.from_warehouse,
    b.to_warehouse,
    b.quantity,
  ].map(toNum);

  // Only checks that we got numbers; stock and capacity rules live in the database
  if (![product, from, to, qty].every(Number.isInteger)) {
    return NextResponse.json(
      { error: "Select a product, both warehouses and enter a whole-number quantity" },
      { status: 400 }
    );
  }

  try {
    await query("CALL transfer_stock($1::int, $2::int, $3::int, $4::int)", [
      product,
      from,
      to,
      qty,
    ]);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return dbErrorResponse(e); // e.g. insufficient stock, capacity exceeded
  }
}