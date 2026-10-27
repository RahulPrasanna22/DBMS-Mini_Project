# MongoDB part: setup and design

This part uses **MongoDB Atlas**, the free cloud version, so nobody has to install MongoDB. Both teammates connect to the same cloud database.

## 1. Create the shared database (one person, once)

1. Sign up at **https://www.mongodb.com/cloud/atlas/register**.
2. Create a cluster. Choose **M0 (Free)**, provider **AWS**, region **Mumbai (ap-south-1)**.
3. **Database Access** → Add New Database User. Choose a username and an auto-generated password, with the role "Read and write to any database".
4. **Network Access** → Add IP Address → **Allow access from anywhere (0.0.0.0/0)**. This is fine for a college project and saves you from adding each home or college IP.
5. Click **Connect** → **Drivers** → copy the connection string. It looks like this:
   `mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/`
6. Send the string to your teammate **privately** (WhatsApp, not GitHub).

To give your teammate access to the Atlas website as well, go to **Project → Access Manager → Invite to Project**.

## 2. Run the scripts

Requires **Node.js 18 or newer**, which the Next.js app needs anyway. From the project root:

```
npm install mongodb dotenv
```

Create a `.env` file in the project root:

```
MONGODB_URI=mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/
MONGODB_DB=supply_chain
```

Make sure `.env` is listed in `.gitignore`. Never commit it.

```
node mongo/setup.mjs          # creates collections, validators, indexes, sample data
node mongo/aggregations.mjs   # runs the aggregation pipelines and prints results
```

`setup.mjs` ends by printing `UPDATE` statements. Run them in psql to store the Mongo ids in `products.mongo_spec_id` and `suppliers.mongo_doc_id`.

`setup.mjs` drops and recreates both collections every time it runs. Re-run it only when you want to reset the sample data.

To see the data visually, go to **Atlas → Browse Collections**. The **Aggregation** tab there can run the same pipelines for the demo.

---

## 3. Design (for the project documentation)

### Why MongoDB for this data

| Data | Store | Reason |
|---|---|---|
| Products, stock, orders, transfers, users | PostgreSQL | Fixed structure, foreign keys, transactions and constraints are required |
| Product specifications | MongoDB | Every category has different attributes. Rice has weight, grain, shelf life and nutrition; a cable has connector, length and wattage. In SQL this would mean many nullable columns or an EAV table |
| Supplier certificates and delivery feedback | MongoDB | Certificate types vary by supplier (FSSAI for food, BIS for electronics). Feedback is free text with a varying list of issue tags, and grows over time as a nested array |

### Collections

**`product_specs`**: one document per product.

| Field | Type | Notes |
|---|---|---|
| `_id` | ObjectId | Stored in `products.mongo_spec_id` |
| `product_id` | int | Links to `products.product_id` (unique) |
| `sku` | string | Unique |
| `category` | string | `Grocery` or `Electronics` |
| `specs` | object | Shape depends on the category |
| `images` | string[] | Optional |
| `updated_at` | date | |

**`supplier_documents`**: one document per supplier.

| Field | Type | Notes |
|---|---|---|
| `_id` | ObjectId | Stored in `suppliers.mongo_doc_id` |
| `supplier_id` | int | Links to `suppliers.supplier_id` (unique) |
| `certifications[]` | array | `{ type, number, valid_until }` |
| `contacts[]` | array | Free-form contact details |
| `feedback[]` | array | `{ po_id, rating 1–5, issues[], comment, date }` |

### Validation (data integrity at the database level)

Both collections use a `$jsonSchema` validator with `validationAction: "error"`:

- Required fields and types (for example, `rating` must be an int from 1 to 5).
- `product_specs` uses `oneOf` per category. A **Grocery** product must have `net_weight_kg`, `shelf_life_days` and `storage`; an **Electronics** product must have `warranty_months` and `certifications`. Flexible structure, still validated.

### Indexes

| Collection | Index | Purpose |
|---|---|---|
| product_specs | `{ product_id: 1 }` unique | Look up specs from a PostgreSQL product |
| product_specs | `{ sku: 1 }` unique | Look up by SKU |
| product_specs | `{ category: 1 }` | Filter by category |
| supplier_documents | `{ supplier_id: 1 }` unique | Look up from a PostgreSQL supplier |
| supplier_documents | `{ "certifications.valid_until": 1 }` | Expiring-certificate alerts |
| supplier_documents | `{ "feedback.issues": 1 }` | Multikey index on issue tags |

### Aggregation pipelines (NoSQL advanced feature)

In `aggregations.mjs`:

1. **Supplier scorecard**: `$unwind` feedback → `$group` by supplier with average rating, review count and issue count → worst suppliers first.
2. **Top delivery issues**: double `$unwind` (feedback, then issues) → count per issue tag and list which suppliers had it.
3. **Expiring certificates**: certificates expiring within 30 days, with `days_left` calculated using `$dateDiff`.
4. **Spec fields by category**: `$objectToArray` lists which spec fields each category uses, which shows the flexible schema in the demo.

The pipelines are exported, so the Next.js API routes can import and reuse them.

### Retrieval strategy (how the app combines both databases)

1. The product page loads the product row from PostgreSQL (price, stock and so on).
2. It uses `product_id` to fetch the matching `product_specs` document from MongoDB.
3. The supplier page combines the PostgreSQL supplier row and its purchase orders with the MongoDB certificates and the scorecard aggregation.
