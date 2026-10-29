import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { dbErrorResponse } from "@/lib/dberror";
import { mongoErrorResponse } from "@/lib/mongoerror";
import { parseSupplierId, getSupplier, pushToSupplierDoc } from "@/lib/supplierDocs";

// POST /api/suppliers/[id]/certifications   body: { type, number, valid_until: "YYYY-MM-DD" }
// Certificate types differ per supplier (FSSAI, BIS, ISO ...), which is why they live in MongoDB.
export async function POST(request, { params }) {
  const { error } = await requireRole("ADMIN");
  if (error) return error;

  const { id, error: idError } = await parseSupplierId(params);
  if (idError) return idError;

  const b = await request.json().catch(() => ({}));
  const type = typeof b.type === "string" ? b.type.trim() : "";
  const number = typeof b.number === "string" ? b.number.trim() : "";
  const validUntil = new Date(b.valid_until);

  if (!type || !number) {
    return NextResponse.json({ error: "Certificate type and number are required" }, { status: 400 });
  }
  if (Number.isNaN(validUntil.getTime())) {
    return NextResponse.json({ error: "Enter a valid expiry date" }, { status: 400 });
  }

  try {
    if (!(await getSupplier(id))) {
      return NextResponse.json({ error: "Supplier not found" }, { status: 404 });
    }
  } catch (e) {
    return dbErrorResponse(e);
  }

  try {
    await pushToSupplierDoc(id, "certifications", { type, number, valid_until: validUntil });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (e) {
    if (typeof e?.code === "string") return dbErrorResponse(e);
    return mongoErrorResponse(e);
  }
}
