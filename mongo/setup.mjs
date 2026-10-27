// MongoDB setup for Smart Inventory & Supply Chain Tracker
// Creates collections (with validation), indexes, and sample documents
// that match the PostgreSQL seed data (product_id / supplier_id).
//
// Run from the project root:   node mongo/setup.mjs
// Needs MONGODB_URI (and optionally MONGODB_DB) in .env

import 'dotenv/config';
import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || 'supply_chain';
if (!uri) {
  console.error('MONGODB_URI is missing. Add it to your .env file.');
  process.exit(1);
}

const daysFromNow = (d) => new Date(Date.now() + d * 86400000);

const client = new MongoClient(uri);

try {
  await client.connect();
  const db = client.db(dbName);
  console.log(`Connected to database "${dbName}"`);

  // Start clean so the script can be re-run safely
  for (const name of ['product_specs', 'supplier_documents']) {
    if ((await db.listCollections({ name }).toArray()).length) {
      await db.collection(name).drop();
    }
  }

  // ---------- product_specs ----------
  // Each category has its own required spec fields; the shape differs per product.
  await db.createCollection('product_specs', {
    validator: {
      $jsonSchema: {
        bsonType: 'object',
        required: ['product_id', 'sku', 'category', 'specs'],
        properties: {
          product_id: { bsonType: 'int', minimum: 1, description: 'products.product_id in PostgreSQL' },
          sku:        { bsonType: 'string' },
          category:   { bsonType: 'string' },
          specs:      { bsonType: 'object' },
          images:     { bsonType: 'array', items: { bsonType: 'string' } },
          updated_at: { bsonType: 'date' }
        },
        oneOf: [
          {
            properties: {
              category: { enum: ['Grocery'] },
              specs: { bsonType: 'object', required: ['net_weight_kg', 'shelf_life_days', 'storage'] }
            }
          },
          {
            properties: {
              category: { enum: ['Electronics'] },
              specs: { bsonType: 'object', required: ['warranty_months', 'certifications'] }
            }
          }
        ]
      }
    },
    validationAction: 'error'
  });

  const specs = db.collection('product_specs');
  await specs.createIndex({ product_id: 1 }, { unique: true });
  await specs.createIndex({ sku: 1 }, { unique: true });
  await specs.createIndex({ category: 1 });

  const specResult = await specs.insertMany([
    {
      product_id: 1, sku: 'G-001', category: 'Grocery',
      specs: {
        net_weight_kg: 5, grain: 'Long grain', aged_months: 12,
        shelf_life_days: 365, storage: 'Cool, dry place',
        allergens: [], fssai_license: '10012345000123',
        nutrition_per_100g: { energy_kcal: 350, protein_g: 7.5, carbs_g: 78 }
      },
      images: ['rice-front.jpg'],
      updated_at: new Date()
    },
    {
      product_id: 2, sku: 'E-001', category: 'Electronics',
      specs: {
        connector: 'USB-C to USB-C', length_m: 1.5, max_wattage: 60,
        data_rate_gbps: 0.48, braided: true,
        warranty_months: 12, certifications: ['BIS', 'RoHS']
      },
      images: ['cable-coil.jpg', 'cable-ends.jpg'],
      updated_at: new Date()
    }
  ]);

  // ---------- supplier_documents ----------
  // Certificates differ by supplier type; feedback is free text with tags.
  await db.createCollection('supplier_documents', {
    validator: {
      $jsonSchema: {
        bsonType: 'object',
        required: ['supplier_id', 'certifications', 'feedback'],
        properties: {
          supplier_id: { bsonType: 'int', minimum: 1, description: 'suppliers.supplier_id in PostgreSQL' },
          certifications: {
            bsonType: 'array',
            items: {
              bsonType: 'object',
              required: ['type', 'number', 'valid_until'],
              properties: {
                type: { bsonType: 'string' },
                number: { bsonType: 'string' },
                valid_until: { bsonType: 'date' }
              }
            }
          },
          feedback: {
            bsonType: 'array',
            items: {
              bsonType: 'object',
              required: ['po_id', 'rating', 'date'],
              properties: {
                po_id: { bsonType: 'int' },
                rating: { bsonType: 'int', minimum: 1, maximum: 5 },
                issues: { bsonType: 'array', items: { bsonType: 'string' } },
                comment: { bsonType: 'string' },
                date: { bsonType: 'date' }
              }
            }
          }
        }
      }
    },
    validationAction: 'error'
  });

  const docs = db.collection('supplier_documents');
  await docs.createIndex({ supplier_id: 1 }, { unique: true });
  await docs.createIndex({ 'certifications.valid_until': 1 });   // expiring-certificate lookups
  await docs.createIndex({ 'feedback.issues': 1 });              // multikey index on issue tags

  const docResult = await docs.insertMany([
    {
      supplier_id: 1, // Acme Foods
      certifications: [
        { type: 'FSSAI', number: '10012345000123', valid_until: daysFromNow(12) },
        { type: 'ISO 22000', number: 'ISO22K-8841', valid_until: daysFromNow(400) }
      ],
      contacts: [{ name: 'R. Kumar', role: 'Account manager', phone: '+91-9800000001' }],
      feedback: [
        { po_id: 1, rating: 4, issues: [], comment: 'On time, well packed', date: daysFromNow(-20) },
        { po_id: 3, rating: 3, issues: ['late_delivery'], comment: 'Arrived 2 days late', date: daysFromNow(-10) },
        { po_id: 5, rating: 5, issues: [], comment: 'Excellent quality', date: daysFromNow(-3) }
      ]
    },
    {
      supplier_id: 2, // Globex Parts
      certifications: [
        { type: 'BIS', number: 'R-41012345', valid_until: daysFromNow(25) },
        { type: 'GST', number: '33ABCDE1234F1Z5', valid_until: daysFromNow(1000) }
      ],
      contacts: [{ name: 'S. Iyer', role: 'Sales', email: 'sales@globex.com' }],
      feedback: [
        { po_id: 2, rating: 2, issues: ['damaged_packaging', 'short_quantity'], comment: '8 cables missing', date: daysFromNow(-25) },
        { po_id: 4, rating: 3, issues: ['late_delivery'], comment: 'Late by a week', date: daysFromNow(-12) },
        { po_id: 6, rating: 2, issues: ['damaged_packaging'], comment: 'Box crushed', date: daysFromNow(-2) }
      ]
    }
  ]);

  console.log(`Inserted ${specResult.insertedCount} product_specs and ${docResult.insertedCount} supplier_documents.`);

  // Print SQL to store the Mongo ids in PostgreSQL (the mongo_*_id columns)
  console.log('\nRun this in psql to link PostgreSQL rows to these documents:\n');
  const specIds = await specs.find({}, { projection: { product_id: 1 } }).toArray();
  for (const d of specIds) {
    console.log(`UPDATE products  SET mongo_spec_id = '${d._id}' WHERE product_id = ${d.product_id};`);
  }
  const docIds = await docs.find({}, { projection: { supplier_id: 1 } }).toArray();
  for (const d of docIds) {
    console.log(`UPDATE suppliers SET mongo_doc_id  = '${d._id}' WHERE supplier_id = ${d.supplier_id};`);
  }
} catch (err) {
  console.error('Setup failed:', err.message);
  process.exitCode = 1;
} finally {
  await client.close();
}
