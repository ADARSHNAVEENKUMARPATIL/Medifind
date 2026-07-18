-- ==========================================
-- 7. INITIAL SEED RECORDS (TEST DATA)
-- ==========================================

-- 1. INSERT A TEST STORE PROFILE
INSERT INTO stores (id, store_name, drug_license_no, store_address, contact_number)
VALUES (1, 'MediFind Central Pharmacy', 'DL-KA-MYS-2026-X77', '123, Ring Road, Mysuru, Karnataka', '+91 9876543210')
ON CONFLICT (drug_license_no) DO NOTHING;

-- 2. INSERT AN ADMIN PHARMACIST (Linked to Store ID 1)
-- Plain text password for this test is 'Admin@123'
-- Hashed using bcrypt: '$2b$10$UnX7p7i7M7i7M7i7M7i7Mu7R7i7M7i7M7i7M7i7M7i7M7i7M7i7M7'
INSERT INTO pharmacists (id, store_id, pharmacist_reg_no, full_name, email_address, password_hash, status)
VALUES (1, 1, 'KA-PH-55432', 'Adarsh Kumar', 'admin@medifind.com', '$2b$10$UnX7p7i7M7i7M7i7M7i7Mu7R7i7M7i7M7i7M7i7M7i7M7i7M7i7M7', 'Active')
ON CONFLICT (email_address) DO NOTHING;

-- 3. INSERT MEDICINE CATALOG ITEMS (Linked to Store ID 1 with physical rack coordinates)
INSERT INTO medicines (id, store_id, sku, name, category, par_limit, rack, shelf, box, cold_storage) VALUES
(1, 1, 'MED-DOLO-650', 'Dolo 650mg Tablet', 'Analgesic', 50, 'RACK A', 'SHELF 2', 'BOX 05', FALSE),
(2, 1, 'MED-PARA-500', 'Paracetamol 500mg', 'Antipyretic', 30, 'RACK A', 'SHELF 3', 'BOX 02', FALSE),
(3, 1, 'MED-CROC-SYR', 'Crocin Pediatric Syrup', 'Antipyretic', 20, 'RACK B', 'SHELF 1', 'BOX 12', FALSE),
(4, 1, 'MED-PANT-OBD', 'PantoB-D Capsule', 'Gastrointestinal', 40, 'RACK C', 'SHELF 4', 'BOX 09', FALSE)
ON CONFLICT (store_id, sku) DO NOTHING;

-- 4. INSERT STOCK BATCHES FOR THE MEDICINES
-- Batch 1: Healthy Optimal Stock
INSERT INTO batches (medicine_id, received_qty, current_qty, expiry_date)
SELECT 1, 200, 150, '2028-12-31'
WHERE NOT EXISTS (SELECT 1 FROM batches WHERE medicine_id = 1);

-- Batch 2: LOW STOCK ALERT TRIGGER
INSERT INTO batches (medicine_id, received_qty, current_qty, expiry_date)
SELECT 2, 100, 5, '2027-06-15'
WHERE NOT EXISTS (SELECT 1 FROM batches WHERE medicine_id = 2);

-- Batch 3: EXPIRED ALERT TRIGGER
INSERT INTO batches (medicine_id, received_qty, current_qty, expiry_date)
SELECT 3, 50, 25, '2025-05-10'
WHERE NOT EXISTS (SELECT 1 FROM batches WHERE medicine_id = 3);

-- Batch 4: Gastrointestinal Stock
INSERT INTO batches (medicine_id, received_qty, current_qty, expiry_date)
SELECT 4, 120, 85, '2028-04-18'
WHERE NOT EXISTS (SELECT 1 FROM batches WHERE medicine_id = 4);

-- 5. RESET SERIAL SEQUENCES
-- This ensures that when the application inserts new rows, PostgreSQL does not reuse IDs that were explicitly seeded.
SELECT setval('stores_id_seq', COALESCE((SELECT MAX(id) FROM stores), 1));
SELECT setval('pharmacists_id_seq', COALESCE((SELECT MAX(id) FROM pharmacists), 1));
SELECT setval('medicines_id_seq', COALESCE((SELECT MAX(id) FROM medicines), 1));
SELECT setval('batches_id_seq', COALESCE((SELECT MAX(id) FROM batches), 1));

