-- Links PostgreSQL rows to MongoDB Atlas documents (IDs from mongo/setup.mjs)
-- Run after schema.sql and seed_and_test.sql. Re-generate if setup.mjs is rerun.
UPDATE products  SET mongo_spec_id = '6ae0c566d280ebafb952431a' WHERE product_id = 1;
UPDATE products  SET mongo_spec_id = '6ae0c566d280ebafb952431b' WHERE product_id = 2;
UPDATE suppliers SET mongo_doc_id  = '6ae0c566d280ebafb952431c' WHERE supplier_id = 1;
UPDATE suppliers SET mongo_doc_id  = '6ae0c566d280ebafb952431d' WHERE supplier_id = 2;