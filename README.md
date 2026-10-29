# Smart Inventory & Supply Chain Tracker

DBMS Level 3 mini project (PES University). A web app for managing products, stock across warehouses, purchase orders and supplier quality. It uses **PostgreSQL** for structured, transactional data and **MongoDB** for flexible documents.

**Team:** Rahul Prasanna, Prithvish Adhikari

## Why two databases

| Data | Database | Reason |
|---|---|---|
| Users, products, warehouses, inventory, purchase orders, stock movements | PostgreSQL | Fixed structure, foreign keys, CHECK constraints, triggers and transactions are required |
| Product specifications | MongoDB | Each category has different attributes (rice: weight, shelf life; cable: wattage, connector) |
| Supplier certificates and delivery feedback | MongoDB | Certificate types vary by supplier; feedback is free text with a varying list of tags |

The two are linked through `products.mongo_spec_id` / `suppliers.mongo_doc_id`, and through `product_id` / `supplier_id` stored in each MongoDB document.

## Tech stack

- **Frontend and API:** Next.js 16 (App Router), React 19, Tailwind CSS, Recharts
- **SQL:** PostgreSQL 18, accessed with `pg` (parameterised queries, no ORM)
- **NoSQL:** MongoDB Atlas, accessed with the official `mongodb` driver
- **Auth:** bcrypt password hashes, JWT in an httpOnly cookie, three roles (ADMIN, MANAGER, SUPPLIER)

## Database features

**PostgreSQL** (`db/schema.sql`)
- 10 tables with primary keys, foreign keys, UNIQUE and CHECK constraints
- Triggers: warehouse capacity check, and automatic low-stock alerts that resolve themselves
- Stored procedures run as transactions: `receive_purchase_order` and `transfer_stock` (row locking)
- Views: `v_stock_summary`, `v_reorder_suggestions`
- Full-text search: generated `tsvector` column with a GIN index
- Dashboard queries using JOIN, GROUP BY, HAVING, NOT EXISTS subqueries and aggregates

**MongoDB** (`mongo/`, `web/lib/pipelines.js`)
- `$jsonSchema` validators. `product_specs` requires different fields per category (`oneOf`).
- Indexes, including a multikey index on feedback issue tags
- Aggregation pipelines: supplier scorecard, top delivery issues, expiring certificates (`$dateDiff`), spec fields by category (`$objectToArray`)

## Roles

| Feature | ADMIN | MANAGER | SUPPLIER |
|---|---|---|---|
| Dashboard, products, search | ✅ | ✅ | own data only |
| Inventory, transfers, alerts | ✅ | ✅ | ❌ |
| Create / receive purchase orders | ✅ | ✅ | view own only |
| Supplier quality page, record delivery feedback | ✅ | ✅ | ❌ |
| Add supplier certificates | ✅ | ❌ | ❌ |
| Own certificates and feedback ("My Documents") | ✅ | ✅ | ✅ |
| Admin: users, suppliers, warehouses | ✅ | ❌ | ❌ |

## Setup

### Prerequisites
- Node.js 20 or newer (LTS)
- PostgreSQL 18 (`psql` on your PATH)
- Access to the team's MongoDB Atlas cluster (ask for the connection string privately)

### 1. PostgreSQL
```cmd
psql -U postgres -c "CREATE DATABASE inventory_db;"
psql -U postgres -d inventory_db -f db/schema.sql
psql -U postgres -d inventory_db -f db/seed_and_test.sql
psql -U postgres -d inventory_db -f db/link_mongo.sql
```
The seed script prints three errors under `--- expected errors ---`. They are intentional tests of the constraints.

### 2. MongoDB
The Atlas collections already exist. **Do not run `mongo/setup.mjs`.** It resets the shared data and changes the document IDs. See `mongo/README.md` for the design.

### 3. Web app
```cmd
cd web
npm install
copy .env.example .env.local
```
Fill in `web/.env.local`:
```
DATABASE_URL=postgresql://postgres:<password>@localhost:5432/inventory_db
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster-host>/
MONGODB_DB=supply_chain
JWT_SECRET=<random string>
```
Generate a JWT secret with:
```cmd
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 4. Users
```cmd
node --env-file=.env.local scripts/create-user.mjs admin <password> ADMIN
node --env-file=.env.local scripts/create-user.mjs manager <password> MANAGER
node --env-file=.env.local scripts/create-user.mjs acme <password> SUPPLIER 1
node --env-file=.env.local scripts/create-user.mjs --list
```

### 5. Run
```cmd
npm run dev
```
Open http://localhost:3000 and log in. `GET /api/health` checks both database connections.

## Folder structure
```
db/        PostgreSQL schema, seed + tests, Mongo link script
mongo/     Atlas setup script, aggregation pipelines, NoSQL design notes
web/
  app/           pages and API routes (app/api/**/route.js)
  components/    Navbar, ErrorAlert, forms
  lib/           db.js (pg pool), mongodb.js, pipelines.js, auth, error mapping
  scripts/       create-user.mjs, clean-feedback.mjs
  proxy.js       login and role checks for every request
```

## Security
- Passwords are stored only as bcrypt hashes.
- Credentials live in `.env` / `.env.local`, which `.gitignore` excludes.
- All SQL uses parameterised queries (`$1, $2`), so user input is never concatenated into SQL.
- Database errors (CHECK, UNIQUE, triggers, MongoDB validators) are returned to the UI as readable messages, which shows that validation happens in the database.
