// MongoDB aggregation pipelines (NoSQL advanced feature).
// Same pipelines as mongo/aggregations.mjs, without the CLI runner,
// so API routes can import them.

// Optional first stage: limit a pipeline to one supplier
const forSupplier = (supplierId) =>
  supplierId == null ? [] : [{ $match: { supplier_id: supplierId } }];

// 1. Supplier quality scorecard: average rating, number of reviews and issue counts
export const supplierScorecard = (supplierId = null) => [
  ...forSupplier(supplierId),
  { $unwind: "$feedback" },
  {
    $group: {
      _id: "$supplier_id",
      avg_rating: { $avg: "$feedback.rating" },
      reviews: { $sum: 1 },
      issue_count: { $sum: { $size: { $ifNull: ["$feedback.issues", []] } } },
      last_feedback: { $max: "$feedback.date" },
    },
  },
  {
    $project: {
      _id: 0,
      supplier_id: "$_id",
      avg_rating: { $round: ["$avg_rating", 2] },
      reviews: 1,
      issue_count: 1,
      last_feedback: 1,
    },
  },
  { $sort: { avg_rating: 1 } }, // worst suppliers first
];

// 2. Most common delivery problems across all suppliers
export const topIssues = [
  { $unwind: "$feedback" },
  { $unwind: "$feedback.issues" },
  {
    $group: {
      _id: "$feedback.issues",
      occurrences: { $sum: 1 },
      suppliers: { $addToSet: "$supplier_id" },
    },
  },
  { $project: { _id: 0, issue: "$_id", occurrences: 1, suppliers: 1 } },
  { $sort: { occurrences: -1 } },
];

// 3. Certificates expiring within N days (already-expired ones have negative days_left)
export const expiringCertificates = (days = 30, supplierId = null) => [
  ...forSupplier(supplierId),
  { $unwind: "$certifications" },
  {
    $match: {
      "certifications.valid_until": { $lte: new Date(Date.now() + days * 86400000) },
    },
  },
  {
    $project: {
      _id: 0,
      supplier_id: 1,
      type: "$certifications.type",
      number: "$certifications.number",
      valid_until: "$certifications.valid_until",
      days_left: {
        $dateDiff: { startDate: "$$NOW", endDate: "$certifications.valid_until", unit: "day" },
      },
    },
  },
  { $sort: { days_left: 1 } },
];

// 4. Which spec fields each product category uses (shows the flexible schema)
export const specFieldsByCategory = [
  {
    $project: {
      category: 1,
      product_id: 1,
      fields: { $map: { input: { $objectToArray: "$specs" }, as: "f", in: "$$f.k" } },
    },
  },
  { $unwind: "$fields" },
  {
    $group: {
      _id: "$category",
      spec_fields: { $addToSet: "$fields" },
      products: { $addToSet: "$product_id" },
    },
  },
  {
    $project: {
      _id: 0,
      category: "$_id",
      products: 1,
      spec_fields: { $sortArray: { input: "$spec_fields", sortBy: 1 } },
    },
  },
  { $sort: { category: 1 } },
];
