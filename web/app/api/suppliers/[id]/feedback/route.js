import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getDb } from "@/lib/mongodb";
import { requireRole } from "@/lib/auth";
import { dbErrorResponse } from "@/lib/dberror";
import { mongoErrorResponse } from "@/lib/mongoerror";
import { supplierScorecard } from "@/lib/pipelines";
import { ISSUE_TAGS, parseSupplierId, getSupplier, pushToSupplierDoc } from "@/lib/supplierDocs";

// POST /api/suppliers/[id]/feedback   body: { po_id, rating, issues: [], comment }
// Adds delivery feedback for a RECEIVED purchase order to the supplier's MongoDB document.
export async function POST(request, { params }) {
  const { error } = await requireRole("ADMIN", "MANAGER");
  if (error) return error;

  const { id, error: idError } = await parseSupplierId(params);
  if (idError) return idError;

  const b = await request.json().catch(() => ({}));
  const poId = Number(b.po_id);
  const issues = Array.isArray(b.issues) ? b.issues : [];
  const comment = typeof b.comment === "string" ? b.comment.trim() : "";

  if (!Number.isInteger(poId)) {
    return NextResponse.json({ error: "Choose a purchase order" }, { status: 400 });
  }
  const badTag = issues.find((t) => !ISSUE_TAGS.includes(t));
  if (badTag) {
    return NextResponse.json({ error: `Unknown issue tag: ${badTag}` }, { status: 400 });
  }

  // MongoDB has no foreign keys, so the app checks the link to PostgreSQL:
  // the PO must exist, belong to this supplier and already be RECEIVED.
  try {
    if (!(await getSupplier(id))) {
      return NextResponse.json({ error: "Supplier not found" }, { status: 404 });
    }
    const po = await query(
      `SELECT status FROM purchase_orders WHERE po_id = $1 AND supplier_id = $2`,
      [poId, id]
    );
    if (!po.rows[0]) {
      return NextResponse.json({ error: `PO ${poId} does not belong to this supplier` }, { status: 400 });
    }
    if (po.rows[0].status !== "RECEIVED") {
      return NextResponse.json(
        { error: `PO ${poId} is ${po.rows[0].status}; feedback is only allowed after it is received` },
        { status: 400 }
      );
    }
  } catch (e) {
    return dbErrorResponse(e);
  }

  // The rating is NOT range-checked here on purpose: MongoDB's $jsonSchema
  // validator (int, 1 to 5) rejects bad values, which shows DB-level validation.
  const entry = {
    po_id: poId,
    rating: Number(b.rating),
    issues,
    date: new Date(),
  };
  if (comment) entry.comment = comment;

  try {
    const db = await getDb();
    const docs = db.collection("supplier_documents");

    const already = await docs.findOne({ supplier_id: id, "feedback.po_id": poId });
    if (already) {
      return NextResponse.json({ error: `Feedback for PO ${poId} was already recorded` }, { status: 400 });
    }

    await pushToSupplierDoc(id, "feedback", entry);

    // Keep the PostgreSQL rating in sync with the MongoDB average
    const [score] = await docs.aggregate(supplierScorecard(id)).toArray();
    if (score) {
      await query(`UPDATE suppliers SET rating = ROUND($1::numeric, 1) WHERE supplier_id = $2`, [
        score.avg_rating,
        id,
      ]);
    }
    return NextResponse.json({ ok: true, scorecard: score ?? null }, { status: 201 });
  } catch (e) {
    if (typeof e?.code === "string") return dbErrorResponse(e); // PostgreSQL error
    return mongoErrorResponse(e);
  }
}
