import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getDb } from "@/lib/mongodb";
import { requireRole } from "@/lib/auth";
import { dbErrorResponse } from "@/lib/dberror";
import { supplierScorecard, expiringCertificates } from "@/lib/pipelines";
import { parseSupplierId, canView, getSupplier } from "@/lib/supplierDocs";

// GET /api/suppliers/[id]/documents
// Combines PostgreSQL (supplier row, received purchase orders)
// with MongoDB (certificates, contacts, feedback, scorecard).
export async function GET(request, { params }) {
  const { session, error } = await requireRole();
  if (error) return error;

  const { id, error: idError } = await parseSupplierId(params);
  if (idError) return idError;

  // Same 404 for "missing" and "not yours", so suppliers can't probe other ids
  if (!canView(session, id)) {
    return NextResponse.json({ error: "Supplier not found" }, { status: 404 });
  }

  let supplier, receivedPOs;
  try {
    supplier = await getSupplier(id);
    if (!supplier) {
      return NextResponse.json({ error: "Supplier not found" }, { status: 404 });
    }
    // Received POs are the only ones that can get delivery feedback
    const r = await query(
      `SELECT po.po_id,
              to_char(po.received_date, 'YYYY-MM-DD') AS received_date,
              w.name AS warehouse,
              COALESCE(SUM(i.quantity * i.unit_cost), 0) AS total_value
       FROM purchase_orders po
       JOIN warehouses w ON w.warehouse_id = po.warehouse_id
       LEFT JOIN po_items i ON i.po_id = po.po_id
       WHERE po.supplier_id = $1 AND po.status = 'RECEIVED'
       GROUP BY po.po_id, w.name
       ORDER BY po.po_id DESC`,
      [id]
    );
    receivedPOs = r.rows;
  } catch (e) {
    return dbErrorResponse(e);
  }

  // MongoDB part: if Atlas is unreachable, the page still shows the PostgreSQL data
  let documents = null;
  let scorecard = null;
  let expiring = [];
  let mongoError = null;
  try {
    const db = await getDb();
    const docs = db.collection("supplier_documents");
    const [doc, score, exp] = await Promise.all([
      docs.findOne({ supplier_id: id }),
      docs.aggregate(supplierScorecard(id)).toArray(),
      docs.aggregate(expiringCertificates(30, id)).toArray(),
    ]);
    if (doc) {
      documents = {
        mongo_id: String(doc._id),
        certifications: doc.certifications ?? [],
        contacts: doc.contacts ?? [],
        feedback: [...(doc.feedback ?? [])].sort((a, b) => new Date(b.date) - new Date(a.date)),
      };
    }
    scorecard = score[0] ?? null;
    expiring = exp;
  } catch (e) {
    mongoError = e.message;
  }

  const reviewed = new Set((documents?.feedback ?? []).map((f) => f.po_id));
  return NextResponse.json({
    supplier,
    receivedPOs: receivedPOs.map((po) => ({ ...po, has_feedback: reviewed.has(po.po_id) })),
    documents,
    scorecard,
    expiring,
    mongoError,
  });
}
