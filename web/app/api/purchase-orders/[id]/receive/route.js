import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { dbErrorResponse } from "@/lib/dberror";

// The stored procedure locks the PO, adds stock, logs movements and marks it
// RECEIVED in one transaction. It raises an error if the PO was already received.
export async function POST(request, { params }) {
  const { error } = await requireRole("ADMIN", "MANAGER");
  if (error) return error;

  const id = Number((await params).id);
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: "Invalid purchase order id" }, { status: 400 });
  }

  try {
    await query("CALL receive_purchase_order($1::int)", [id]);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return dbErrorResponse(e); // already received, capacity exceeded, ...
  }
}