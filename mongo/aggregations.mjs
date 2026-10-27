// MongoDB aggregation pipelines (NoSQL advanced feature)
// Run from the project root:   node mongo/aggregations.mjs

import 'dotenv/config';
import { MongoClient } from 'mongodb';
import { pathToFileURL } from 'node:url';

// 1. Supplier quality scorecard: average rating, number of reviews and issue counts
export const supplierScorecard = [
  { $unwind: '$feedback' },
  {
    $group: {
      _id: '$supplier_id',
      avg_rating: { $avg: '$feedback.rating' },
      reviews: { $sum: 1 },
      issue_count: { $sum: { $size: { $ifNull: ['$feedback.issues', []] } } },
      last_feedback: { $max: '$feedback.date' }
    }
  },
  { $project: { _id: 0, supplier_id: '$_id', avg_rating: { $round: ['$avg_rating', 2] }, reviews: 1, issue_count: 1, last_feedback: 1 } },
  { $sort: { avg_rating: 1 } }            // worst suppliers first
];

// 2. Most common delivery problems across all suppliers
export const topIssues = [
  { $unwind: '$feedback' },
  { $unwind: '$feedback.issues' },
  { $group: { _id: '$feedback.issues', occurrences: { $sum: 1 }, suppliers: { $addToSet: '$supplier_id' } } },
  { $project: { _id: 0, issue: '$_id', occurrences: 1, suppliers: 1 } },
  { $sort: { occurrences: -1 } }
];

// 3. Certificates expiring within N days (compliance alert)
export const expiringCertificates = (days = 30) => [
  { $unwind: '$certifications' },
  { $match: { 'certifications.valid_until': { $lte: new Date(Date.now() + days * 86400000) } } },
  {
    $project: {
      _id: 0, supplier_id: 1,
      type: '$certifications.type',
      number: '$certifications.number',
      valid_until: '$certifications.valid_until',
      days_left: { $dateDiff: { startDate: '$$NOW', endDate: '$certifications.valid_until', unit: 'day' } }
    }
  },
  { $sort: { days_left: 1 } }
];

// 4. Which spec fields each category uses (shows the flexible schema)
export const specFieldsByCategory = [
  { $project: { category: 1, product_id: 1, fields: { $map: { input: { $objectToArray: '$specs' }, as: 'f', in: '$$f.k' } } } },
  { $unwind: '$fields' },
  { $group: { _id: '$category', spec_fields: { $addToSet: '$fields' }, products: { $addToSet: '$product_id' } } },
  { $project: { _id: 0, category: '$_id', products: 1, spec_fields: { $sortArray: { input: '$spec_fields', sortBy: 1 } } } },
  { $sort: { category: 1 } }
];

// Run the demo only when this file is executed directly (not when imported by the app)
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
const client = new MongoClient(process.env.MONGODB_URI);
const dbName = process.env.MONGODB_DB || 'supply_chain';
try {
  await client.connect();
  const db = client.db(dbName);
  const docs = db.collection('supplier_documents');
  const specs = db.collection('product_specs');

  console.log('\n1. Supplier scorecard');
  console.table(await docs.aggregate(supplierScorecard).toArray());

  console.log('\n2. Top delivery issues');
  console.table(await docs.aggregate(topIssues).toArray());

  console.log('\n3. Certificates expiring in the next 30 days');
  console.table(await docs.aggregate(expiringCertificates(30)).toArray());

  console.log('\n4. Spec fields by category');
  for (const row of await specs.aggregate(specFieldsByCategory).toArray()) {
    console.log(`${row.category} (products ${row.products.join(', ')}): ${row.spec_fields.join(', ')}`);
  }

  console.log('\n5. Query: Electronics products supporting 45 W or more');
  console.table(await specs.find(
    { category: 'Electronics', 'specs.max_wattage': { $gte: 45 } },
    { projection: { _id: 0, product_id: 1, sku: 1, 'specs.max_wattage': 1 } }
  ).toArray());
} catch (err) {
  console.error('Aggregation failed:', err.message);
  process.exitCode = 1;
} finally {
  await client.close();
}
}
