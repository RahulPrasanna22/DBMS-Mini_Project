import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getDb } from "@/lib/mongodb";
import { requireRole } from "@/lib/auth";
import { mongoErrorResponse } from "@/lib/mongoerror";
import {
  supplierScorecard,
  topIssues,
  expiringCertificates,
  specFieldsByCategory,
} from "@/lib/pipelines";

// GET /api/supplier-quality?days=30
// Runs the 4 MongoDB aggregation pipelines, then adds supplier names from PostgreSQL.
export async function GET(request) {
  const { error } = await requireRole("ADMIN", "MANAGER");
  if (error) return error;

  const days = Number(request.nextUrl.searchParams.get("days") ?? 30);
  if (!Number.isInteger(days) || days < 1 || days > 3650) {
    return NextResponse.json({ error: "days must be a whole number from 1 to 3650" }, { status: 400 });
  }

  try {
    const db = await getDb();
    const docs = db.collection("supplier_documents");
    const specs = db.collection("product_specs");

    const [scorecard, issues, expiring, specFields, idsWithDocs] = await Promise.all([
      docs.aggregate(supplierScorecard()).toArray(),
      docs.aggregate(topIssues).toArray(),
      docs.aggregate(expiringCertificates(days)).toArray(),
      specs.aggregate(specFieldsByCategory).toArray(),
      docs.distinct("supplier_id"),
    ]);

    // PostgreSQL is the source of truth for supplier names and status
    const pg = await query(
      `SELECT supplier_id, name, city, active FROM suppliers ORDER BY name`
    );
    const byId = new Map(pg.rows.map((s) => [s.supplier_id, s]));
    const nameOf = (id) => byId.get(id)?.name ?? `Supplier #${id} (not in PostgreSQL)`;

    return NextResponse.json({
      days,
      scorecard: scorecard.map((r) => ({ ...r, name: nameOf(r.supplier_id), city: byId.get(r.supplier_id)?.city ?? null })),
      topIssues: issues.map((r) => ({ ...r, supplier_names: r.suppliers.map(nameOf) })),
      expiring: expiring.map((r) => ({ ...r, name: nameOf(r.supplier_id) })),
      specFields,
      // Suppliers in PostgreSQL that have no MongoDB document yet
      withoutDocuments: pg.rows.filter((s) => !idsWithDocs.includes(s.supplier_id)),
    });
  } catch (e) {
    return mongoErrorResponse(e);
  }
}
