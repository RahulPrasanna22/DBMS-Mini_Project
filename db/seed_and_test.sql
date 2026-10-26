INSERT INTO suppliers(name,email,city,rating) VALUES ('Acme Foods','a@acme.com','Bengaluru',4.5),('Globex Parts','g@globex.com','Chennai',3.8);
INSERT INTO categories(name) VALUES ('Grocery'),('Electronics');
INSERT INTO users(username,password_hash,role) VALUES ('admin','$2b$10$placeholderhash','ADMIN');
INSERT INTO products(sku,name,description,category_id,supplier_id,unit_price,reorder_level)
VALUES ('G-001','Basmati Rice 5kg','Long grain aged rice',1,1,450,20),('E-001','USB-C Cable','Braided fast charging cable',2,2,299,15);
INSERT INTO warehouses(name,city,capacity) VALUES ('WH-Blr','Bengaluru',500),('WH-Che','Chennai',60),('WH-Hyd','Hyderabad',500);
INSERT INTO purchase_orders(supplier_id,warehouse_id,created_by) VALUES (1,1,1);
INSERT INTO po_items VALUES (1,1,100,400);
CALL receive_purchase_order(1);
CALL transfer_stock(1,1,3,85);                       -- WH1 left with 15 (<= 20): alert expected
SELECT warehouse_id,product_id,quantity FROM inventory ORDER BY 1;
SELECT product_id,warehouse_id,quantity,resolved FROM low_stock_alerts;
SELECT * FROM v_reorder_suggestions;
CALL transfer_stock(1,3,1,30);                       -- WH1 back to 45: alert resolved
SELECT product_id,warehouse_id,quantity,resolved FROM low_stock_alerts;
\echo '--- expected errors ---'
CALL transfer_stock(1,1,3,500);
CALL transfer_stock(1,1,2,45);
CALL receive_purchase_order(1);
\echo '--- movements / views / FTS ---'
SELECT movement_type,warehouse_id,change_qty FROM stock_movements ORDER BY movement_id;
SELECT sku,total_stock,stock_value FROM v_stock_summary;
SELECT sku FROM products WHERE search @@ plainto_tsquery('english','charging cable');
