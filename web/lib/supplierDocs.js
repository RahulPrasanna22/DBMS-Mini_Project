import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getDb } from "@/lib/mongodb";

export const ISSUE_TAGS = [
  "late_delivery",
  "damaged_packaging",
  "short_quantity",
  "wrong_item",
  "quality_issue",
  "missing_documents",
];

// Parse the [id] route param. Returns { id } or { error: response }.
export async function parseSupplierId(params) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id < 1) {
    return { error: NextResponse.json({ error: "Invalid supplier id" }, { status: 400 }) };
  }
  return { id };
}

// A SUPPLIER may only see their own documents; staff may see all.
export function canView(session, supplierId) {
  return session.role !== "SUPPLIER" || Number(session.supplier_id) === supplierId;
}

// Load the supplier row from PostgreSQL (the source of truth for suppliers).
export async function getSupplier(id) {
  const r = await query(
    `SELECT supplier_id, name, email, phone, city, rating, active, mongo_doc_id
     FROM suppliers WHERE supplier_id = $1`,
    [id]
  );
  return r.rows[0] ?? null;
}

// Add to an array in the supplier's MongoDB document, creating the document
// on first use (upsert). Suppliers added later in the app have no document yet.
// After creating one, store its ObjectId in suppliers.mongo_doc_id so both
// databases stay linked.
export async function pushToSupplierDoc(supplierId, field, value) {
  const db = await getDb();
  const empty = { certifications: [], contacts: [], feedback: [] };
  delete empty[field]; // the field being pushed to cannot also be in $setOnInsert

  const result = await db.collection("supplier_documents").updateOne(
    { supplier_id: supplierId },
    { $push: { [field]: value }, $setOnInsert: empty },
    { upsert: true }
  );

  if (result.upsertedId) {
    await query(`UPDATE suppliers SET mongo_doc_id = $1 WHERE supplier_id = $2`, [
      String(result.upsertedId),
      supplierId,
    ]);
  }
  return result;
}
