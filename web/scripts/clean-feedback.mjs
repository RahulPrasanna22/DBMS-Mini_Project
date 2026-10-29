// Removes MongoDB feedback entries whose purchase order is not a RECEIVED PO
// of that supplier in PostgreSQL (the first sample data used made-up PO numbers).
// Then sets suppliers.rating in PostgreSQL to the new MongoDB average.
//
// Needs BOTH databases, so run it on the machine with PostgreSQL (from the web folder):
//   node --env-file=.env.local scripts/clean-feedback.mjs          <- dry run, shows what would change
//   node --env-file=.env.local scripts/clean-feedback.mjs --apply  <- actually changes the data
import pg from "pg";
import { MongoClient } from "mongodb";

const apply = process.argv.includes("--apply");
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const mongo = new MongoClient(process.env.MONGODB_URI);

try {
  await mongo.connect();
  const docs = mongo.db(process.env.MONGODB_DB).collection("supplier_documents");

  for (const doc of await docs.find({}).toArray()) {
    const r = await pool.query(
      `SELECT po_id FROM purchase_orders WHERE supplier_id = $1 AND status = 'RECEIVED'`,
      [doc.supplier_id]
    );
    const validPOs = r.rows.map((row) => row.po_id);
    const remove = (doc.feedback ?? []).filter((f) => !validPOs.includes(f.po_id));
    const keep = (doc.feedback ?? []).length - remove.length;

    console.log(
      `Supplier ${doc.supplier_id}: keep ${keep}, remove ${remove.length}` +
        (remove.length ? ` (PO ${remove.map((f) => f.po_id).join(", ")})` : "")
    );
    if (!apply || remove.length === 0) continue;

    await docs.updateOne(
      { _id: doc._id },
      { $pull: { feedback: { po_id: { $nin: validPOs } } } }
    );

    // New average (or NULL rating if no feedback is left)
    const ratings = (await docs.findOne({ _id: doc._id })).feedback.map((f) => f.rating);
    const avg = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null;
    await pool.query(
      `UPDATE suppliers SET rating = ROUND($1::numeric, 1) WHERE supplier_id = $2`,
      [avg, doc.supplier_id]
    );
  }

  console.log(apply ? "\nDone." : "\nDry run only. Add --apply to make these changes.");
} catch (e) {
  console.error("Failed:", e.message);
  process.exitCode = 1;
} finally {
  await mongo.close();
  await pool.end();
}
