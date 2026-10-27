-- Smart Inventory & Supply Chain Tracker : PostgreSQL schema
-- Run: psql -d inventory_db -f schema.sql

DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;

-- ============ TABLES ============

CREATE TABLE users (
    user_id        SERIAL PRIMARY KEY,
    username       VARCHAR(50)  NOT NULL UNIQUE,
    password_hash  TEXT         NOT NULL,                 -- bcrypt hash, never plain text
    role           VARCHAR(20)  NOT NULL CHECK (role IN ('ADMIN','MANAGER','SUPPLIER')),
    supplier_id    INT,                                   -- set only for SUPPLIER users
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE categories (
    category_id  SERIAL PRIMARY KEY,
    name         VARCHAR(80) NOT NULL UNIQUE
);

CREATE TABLE suppliers (
    supplier_id  SERIAL PRIMARY KEY,
    name         VARCHAR(120) NOT NULL,
    email        VARCHAR(120) NOT NULL UNIQUE CHECK (email LIKE '%_@_%._%'),
    phone        VARCHAR(20),
    city         VARCHAR(80),
    rating       NUMERIC(2,1) CHECK (rating BETWEEN 0 AND 5),
    active       BOOLEAN NOT NULL DEFAULT TRUE,
    mongo_doc_id VARCHAR(24)                              -- link to supplier documents in MongoDB
);

ALTER TABLE users
    ADD CONSTRAINT fk_users_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(supplier_id),
    ADD CONSTRAINT chk_supplier_role CHECK ((role = 'SUPPLIER') = (supplier_id IS NOT NULL));

CREATE TABLE products (
    product_id     SERIAL PRIMARY KEY,
    sku            VARCHAR(30)  NOT NULL UNIQUE,
    name           VARCHAR(150) NOT NULL,
    description    TEXT,
    category_id    INT NOT NULL REFERENCES categories(category_id),
    supplier_id    INT NOT NULL REFERENCES suppliers(supplier_id),
    unit_price     NUMERIC(10,2) NOT NULL CHECK (unit_price >= 0),
    reorder_level  INT NOT NULL DEFAULT 10 CHECK (reorder_level >= 0),  -- per-warehouse threshold
    mongo_spec_id  VARCHAR(24),                           -- link to product specs in MongoDB
    search         tsvector GENERATED ALWAYS AS
                   (to_tsvector('english', coalesce(name,'') || ' ' || coalesce(description,''))) STORED
);

CREATE TABLE warehouses (
    warehouse_id  SERIAL PRIMARY KEY,
    name          VARCHAR(100) NOT NULL UNIQUE,
    city          VARCHAR(80)  NOT NULL,
    capacity      INT NOT NULL CHECK (capacity > 0)        -- max total units
);

CREATE TABLE inventory (
    warehouse_id  INT NOT NULL REFERENCES warehouses(warehouse_id),
    product_id    INT NOT NULL REFERENCES products(product_id),
    quantity      INT NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (warehouse_id, product_id)
);

CREATE TABLE purchase_orders (
    po_id          SERIAL PRIMARY KEY,
    supplier_id    INT NOT NULL REFERENCES suppliers(supplier_id),
    warehouse_id   INT NOT NULL REFERENCES warehouses(warehouse_id),
    created_by     INT NOT NULL REFERENCES users(user_id),
    status         VARCHAR(12) NOT NULL DEFAULT 'ORDERED'
                   CHECK (status IN ('ORDERED','RECEIVED','CANCELLED')),
    order_date     DATE NOT NULL DEFAULT CURRENT_DATE,
    expected_date  DATE,
    received_date  DATE,
    CHECK (expected_date IS NULL OR expected_date >= order_date),
    CHECK ((status = 'RECEIVED') = (received_date IS NOT NULL))
);

CREATE TABLE po_items (
    po_id       INT NOT NULL REFERENCES purchase_orders(po_id) ON DELETE CASCADE,
    product_id  INT NOT NULL REFERENCES products(product_id),
    quantity    INT NOT NULL CHECK (quantity > 0),
    unit_cost   NUMERIC(10,2) NOT NULL CHECK (unit_cost >= 0),
    PRIMARY KEY (po_id, product_id)
);

CREATE TABLE stock_movements (
    movement_id   BIGSERIAL PRIMARY KEY,
    product_id    INT NOT NULL REFERENCES products(product_id),
    warehouse_id  INT NOT NULL REFERENCES warehouses(warehouse_id),
    change_qty    INT NOT NULL CHECK (change_qty <> 0),
    movement_type VARCHAR(15) NOT NULL CHECK (movement_type IN ('PO_RECEIPT','TRANSFER_IN','TRANSFER_OUT','ADJUSTMENT')),
    reference_id  INT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE low_stock_alerts (
    alert_id      SERIAL PRIMARY KEY,
    product_id    INT NOT NULL REFERENCES products(product_id),
    warehouse_id  INT NOT NULL REFERENCES warehouses(warehouse_id),
    quantity      INT NOT NULL,
    resolved      BOOLEAN NOT NULL DEFAULT FALSE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============ INDEXES ============

CREATE INDEX idx_products_search   ON products USING GIN (search);          -- full-text search
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_supplier ON products(supplier_id);
CREATE INDEX idx_po_status         ON purchase_orders(status, supplier_id);
CREATE INDEX idx_movements_product ON stock_movements(product_id, created_at DESC);
CREATE INDEX idx_alerts_open       ON low_stock_alerts(product_id) WHERE resolved = FALSE;

-- ============ TRIGGERS ============

-- 1. Block stock that would exceed a warehouse's capacity
CREATE FUNCTION check_warehouse_capacity() RETURNS trigger AS $$
DECLARE v_cap INT; v_used INT;
BEGIN
    SELECT capacity INTO v_cap FROM warehouses WHERE warehouse_id = NEW.warehouse_id;
    SELECT COALESCE(SUM(quantity),0) INTO v_used
      FROM inventory
     WHERE warehouse_id = NEW.warehouse_id AND product_id <> NEW.product_id;
    IF v_used + NEW.quantity > v_cap THEN
        RAISE EXCEPTION 'Warehouse % capacity exceeded (% + % > %)',
                        NEW.warehouse_id, v_used, NEW.quantity, v_cap;
    END IF;
    NEW.updated_at := now();
    RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_capacity BEFORE INSERT OR UPDATE ON inventory
FOR EACH ROW EXECUTE FUNCTION check_warehouse_capacity();

-- 2. Raise a low-stock alert when quantity drops to or below the reorder level
CREATE FUNCTION raise_low_stock_alert() RETURNS trigger AS $$
DECLARE v_level INT;
BEGIN
    SELECT reorder_level INTO v_level FROM products WHERE product_id = NEW.product_id;
    IF NEW.quantity <= v_level AND (TG_OP = 'INSERT' OR OLD.quantity > v_level) THEN
        INSERT INTO low_stock_alerts(product_id, warehouse_id, quantity)
        VALUES (NEW.product_id, NEW.warehouse_id, NEW.quantity);
    ELSIF NEW.quantity > v_level THEN
        UPDATE low_stock_alerts SET resolved = TRUE
         WHERE product_id = NEW.product_id AND warehouse_id = NEW.warehouse_id AND NOT resolved;
    END IF;
    RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_low_stock AFTER INSERT OR UPDATE OF quantity ON inventory
FOR EACH ROW EXECUTE FUNCTION raise_low_stock_alert();

-- ============ VIEWS ============

CREATE VIEW v_stock_summary AS
SELECT p.product_id, p.sku, p.name, c.name AS category,
       COALESCE(SUM(i.quantity),0) AS total_stock,
       COALESCE(SUM(i.quantity),0) * p.unit_price AS stock_value
FROM products p
JOIN categories c ON c.category_id = p.category_id
LEFT JOIN inventory i ON i.product_id = p.product_id
GROUP BY p.product_id, p.sku, p.name, c.name, p.unit_price;

CREATE VIEW v_reorder_suggestions AS
SELECT i.warehouse_id, w.name AS warehouse, p.product_id, p.sku, p.name,
       i.quantity, p.reorder_level,
       (p.reorder_level * 2 - i.quantity) AS suggested_order_qty,
       s.supplier_id, s.name AS supplier
FROM inventory i
JOIN products p   ON p.product_id   = i.product_id
JOIN warehouses w ON w.warehouse_id = i.warehouse_id
JOIN suppliers s  ON s.supplier_id  = p.supplier_id
WHERE i.quantity <= p.reorder_level;

-- ============ STORED PROCEDURES (each runs as one transaction) ============

-- Receive a purchase order: add stock, log movements, close the PO
CREATE PROCEDURE receive_purchase_order(p_po_id INT) LANGUAGE plpgsql AS $$
DECLARE v_status TEXT; v_wh INT; r RECORD;
BEGIN
    SELECT status, warehouse_id INTO v_status, v_wh
      FROM purchase_orders WHERE po_id = p_po_id FOR UPDATE;      -- lock the PO row
    IF NOT FOUND THEN RAISE EXCEPTION 'PO % not found', p_po_id; END IF;
    IF v_status <> 'ORDERED' THEN RAISE EXCEPTION 'PO % is already %', p_po_id, v_status; END IF;

    FOR r IN SELECT product_id, quantity FROM po_items WHERE po_id = p_po_id LOOP
        INSERT INTO inventory(warehouse_id, product_id, quantity)
        VALUES (v_wh, r.product_id, r.quantity)
        ON CONFLICT (warehouse_id, product_id)
        DO UPDATE SET quantity = inventory.quantity + EXCLUDED.quantity;

        INSERT INTO stock_movements(product_id, warehouse_id, change_qty, movement_type, reference_id)
        VALUES (r.product_id, v_wh, r.quantity, 'PO_RECEIPT', p_po_id);
    END LOOP;

    UPDATE purchase_orders SET status = 'RECEIVED', received_date = CURRENT_DATE WHERE po_id = p_po_id;
END $$;

-- Move stock between warehouses atomically (rows locked in a fixed order to avoid deadlocks)
CREATE PROCEDURE transfer_stock(p_product INT, p_from INT, p_to INT, p_qty INT) LANGUAGE plpgsql AS $$
DECLARE v_have INT;
BEGIN
    IF p_from = p_to THEN RAISE EXCEPTION 'Source and destination must differ'; END IF;
    IF p_qty <= 0 THEN RAISE EXCEPTION 'Quantity must be positive'; END IF;

    PERFORM 1 FROM inventory
     WHERE product_id = p_product AND warehouse_id IN (p_from, p_to)
     ORDER BY warehouse_id FOR UPDATE;

    SELECT quantity INTO v_have FROM inventory WHERE product_id = p_product AND warehouse_id = p_from;
    IF v_have IS NULL OR v_have < p_qty THEN
        RAISE EXCEPTION 'Insufficient stock: have %, need %', COALESCE(v_have,0), p_qty;
    END IF;

    UPDATE inventory SET quantity = quantity - p_qty WHERE product_id = p_product AND warehouse_id = p_from;

    INSERT INTO inventory(warehouse_id, product_id, quantity) VALUES (p_to, p_product, p_qty)
    ON CONFLICT (warehouse_id, product_id) DO UPDATE SET quantity = inventory.quantity + EXCLUDED.quantity;

    INSERT INTO stock_movements(product_id, warehouse_id, change_qty, movement_type)
    VALUES (p_product, p_from, -p_qty, 'TRANSFER_OUT'), (p_product, p_to, p_qty, 'TRANSFER_IN');
END $$;
