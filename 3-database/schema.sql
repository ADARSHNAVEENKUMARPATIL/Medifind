DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS batches CASCADE;
DROP TABLE IF EXISTS medicines CASCADE;
DROP TABLE IF EXISTS pharmacists CASCADE;
DROP TABLE IF EXISTS stores CASCADE;

CREATE TABLE IF NOT EXISTS stores (
    id SERIAL PRIMARY KEY,
    store_name VARCHAR(150) NOT NULL,
    drug_license_no VARCHAR(50) NOT NULL UNIQUE,
    store_address TEXT NOT NULL,
    contact_number VARCHAR(20) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pharmacists (
    id SERIAL PRIMARY KEY,
    store_id INT NOT NULL,
    pharmacist_reg_no VARCHAR(50) NOT NULL UNIQUE,
    full_name VARCHAR(100) NOT NULL,
    email_address VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    status VARCHAR(20) DEFAULT 'Active' CHECK (status IN ('Active', 'Suspended')),
    CONSTRAINT fk_pharmacists_store
        FOREIGN KEY (store_id) REFERENCES stores (id)
        ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS medicines (
    id SERIAL PRIMARY KEY,
    store_id INT NOT NULL,
    sku VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL,
    category VARCHAR(50) NOT NULL,
    par_limit INT NOT NULL DEFAULT 100,
    rack VARCHAR(10) NOT NULL,
    shelf VARCHAR(10) NOT NULL,
    box VARCHAR(10) NOT NULL,
    cold_storage BOOLEAN DEFAULT FALSE,
    CONSTRAINT uk_store_sku UNIQUE (store_id, sku),
    CONSTRAINT fk_medicines_store
        FOREIGN KEY (store_id) REFERENCES stores (id)
        ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS batches (
    id SERIAL PRIMARY KEY,
    medicine_id INT NOT NULL,
    received_qty INT NOT NULL,
    current_qty INT NOT NULL,
    expiry_date DATE NOT NULL,
    received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_batches_medicine
        FOREIGN KEY (medicine_id) REFERENCES medicines (id)
        ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    store_id INT NOT NULL,
    pharmacist_id INT NOT NULL,
    medication_name VARCHAR(100) NOT NULL,
    action_type VARCHAR(20) NOT NULL CHECK (action_type IN ('Inbound', 'Dispatched', 'Quarantined')),
    qty_change INT NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_logs_store
        FOREIGN KEY (store_id) REFERENCES stores (id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_logs_pharmacist
        FOREIGN KEY (pharmacist_id) REFERENCES pharmacists (id)
        ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_medicines_coordinates ON medicines (rack, shelf, box);
CREATE INDEX IF NOT EXISTS idx_batches_expiry ON batches (expiry_date);
CREATE INDEX IF NOT EXISTS idx_logs_action ON audit_logs (action_type);
