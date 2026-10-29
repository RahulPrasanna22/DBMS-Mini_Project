import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { dbErrorResponse } from "@/lib/dberror";

// Only a PO that is still ORDERED can be cancelled
export async function POST(request, { params }) {
  const { error } = await requireRole("ADMIN", "MANAGER");
  if (error) return error;

  const id = Number((await params).id);
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: "Invalid purchase order id" }, { status: 400 });
  }

  try {
    const result = await query(
      `UPDATE purchase_orders
       SET status = 'CANCELLED'
       WHERE po_id = $1 AND status = 'ORDERED'
       RETURNING po_id`,
      [id]
    );
    if (result.rowCount === 0) {
      return NextResponse.json(
        { error: "Only purchase orders that are still ORDERED can be cancelled" },
        { status: 400 }
      );
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return dbErrorResponse(e);
  }
}