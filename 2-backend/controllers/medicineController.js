const pool = require('../config/db');

// Helper: Calculate days remaining
function getDaysRemaining(expiryDateStr) {
    const expiry = new Date(expiryDateStr);
    const today = new Date();
    const diffTime = expiry - today;
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

// Helper: Format Time string HH:MM:SS
function formatTime(date) {
    return new Date(date).toTimeString().split(' ')[0];
}

// 1. Search Medicines with Coordinates & Quantities
exports.searchMedicines = async (req, res) => {
    const { store_id, query } = req.body;

    if (!store_id) {
        return res.status(400).json({ success: false, message: 'Store ID required.' });
    }

    try {
        let sql = `
            SELECT m.*, 
                   COALESCE(SUM(b.current_qty), 0)::INT as qty,
                   MIN(CASE WHEN b.current_qty > 0 THEN b.expiry_date ELSE NULL END) as expiry_date
            FROM medicines m 
            LEFT JOIN batches b ON m.id = b.medicine_id 
            WHERE m.store_id = $1 
        `;
        const params = [store_id];

        if (query && query.trim() !== '') {
            sql += ` AND (m.name ILIKE $2 OR m.sku ILIKE $2) `;
            params.push(`%${query.trim()}%`);
        }

        sql += ` GROUP BY m.id ORDER BY m.name ASC`;

        const searchRes = await pool.query(sql, params);

        const meds = searchRes.rows.map(row => {
            let status = 'Optimal';
            if (row.qty <= row.par_limit * 0.2) status = 'Critical';
            else if (row.qty <= row.par_limit * 0.5) status = 'Stable';
            
            return {
                id: row.id,
                sku: row.sku,
                name: row.name,
                category: row.category,
                qty: row.qty,
                rack: row.rack,
                shelf: row.shelf,
                box: row.box,
                par: row.par_limit,
                status: status,
                coldStorage: row.cold_storage,
                expiry_date: row.expiry_date
            };
        });

        res.status(200).json({ success: true, medicines: meds });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Database medicine search query failed.', error: err.message });
    }
};

// 2. Inbound Stock Intake (with Auto-Registration of Unregistered Medicines on the fly!)
exports.processIntake = async (req, res) => {
    const { 
        store_id, 
        pharmacist_id, 
        sku, 
        qty,
        quantity,       // alias for qty to handle standard test cases
        price,          // optional price property for database validation
        expiry_date,
        name,           // optional metadata for on-the-fly registration
        category,       // optional metadata
        par_limit,      // optional metadata
        rack,           // optional metadata
        shelf,          // optional metadata
        box,            // optional metadata
        cold_storage    // optional metadata
    } = req.body;

    const rawQty = qty !== undefined ? qty : quantity;

    // 1. Strict Validation of Quantity: Must be a positive integer
    if (rawQty === undefined || rawQty === null) {
        return res.status(400).json({ success: false, message: 'Inbound shipment properties are incomplete.' });
    }

    const parsedQty = Number(rawQty);
    if (isNaN(parsedQty) || !Number.isInteger(parsedQty) || parsedQty <= 0) {
        return res.status(400).json({ success: false, message: 'Quantity must be a positive integer.' });
    }

    // 2. Strict Validation of Price: Must be a positive number if provided
    if (price !== undefined && price !== null) {
        const parsedPrice = Number(price);
        if (isNaN(parsedPrice) || parsedPrice <= 0) {
            return res.status(400).json({ success: false, message: 'Price must be a positive number.' });
        }
    }

    // 3. Strict Validation of Expiry Date: Must be a legitimate future date
    if (!expiry_date) {
        return res.status(400).json({ success: false, message: 'Inbound shipment properties are incomplete.' });
    }

    const expiryTime = Date.parse(expiry_date);
    if (isNaN(expiryTime)) {
        return res.status(400).json({ success: false, message: 'Expiration date must be a legitimate date string.' });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalize to local date boundary
    const expiry = new Date(expiryTime);
    if (expiry <= today) {
        return res.status(400).json({ success: false, message: 'Expiration date must be a future date.' });
    }

    // 4. Verification of IDs and SKU parameters
    if (!store_id || !pharmacist_id || !sku) {
        return res.status(400).json({ success: false, message: 'Inbound shipment properties are incomplete.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Check if medicine exists by SKU
        let medRes = await client.query(
            `SELECT id, name, rack, shelf, box FROM medicines WHERE store_id = $1 AND sku = $2`,
            [store_id, sku]
        );

        let medId;
        let medName;
        let finalRack;
        let finalShelf;
        let finalBox;

        if (medRes.rows.length === 0) {
            // Medicine template does not exist! Let's register it on the fly.
            const newName = name || `Medicine (${sku})`;
            const newCategory = category || 'General';
            const newPar = par_limit ? parseInt(par_limit) : 100;
            const newRack = (rack || 'RACK A').toUpperCase().trim();
            const newShelf = (shelf || 'SHELF 1').toUpperCase().trim();
            const newBox = (box || 'BOX 01').toUpperCase().trim();
            const newCold = cold_storage === true || cold_storage === 'true';

            // Spatial Coordinate Collision Check (Upgrade 2)
            const locationRes = await client.query(
                `SELECT sku, name FROM medicines 
                 WHERE store_id = $1 
                   AND REPLACE(UPPER(TRIM(rack)), ' ', '') = REPLACE($2, ' ', '')
                   AND REPLACE(UPPER(TRIM(shelf)), ' ', '') = REPLACE($3, ' ', '')
                   AND REPLACE(UPPER(TRIM(box)), ' ', '') = REPLACE($4, ' ', '')`,
                [store_id, newRack, newShelf, newBox]
            );

            if (locationRes.rows.length > 0) {
                await client.query('ROLLBACK');
                return res.status(409).json({ 
                    success: false, 
                    conflict: true,
                    occupiedByName: locationRes.rows[0].name,
                    message: `Location Conflict! This shelf position is already allocated to ${locationRes.rows[0].name}. Please choose an available coordinate or free up the shelf slot.` 
                });
            }

            const insertMedRes = await client.query(
                `INSERT INTO medicines (store_id, sku, name, category, par_limit, rack, shelf, box, cold_storage)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id, name, rack, shelf, box`,
                [store_id, sku.toUpperCase().trim(), newName, newCategory, newPar, newRack, newShelf, newBox, newCold]
            );
            medId = insertMedRes.rows[0].id;
            medName = insertMedRes.rows[0].name;
            finalRack = insertMedRes.rows[0].rack;
            finalShelf = insertMedRes.rows[0].shelf;
            finalBox = insertMedRes.rows[0].box;
        } else {
            medId = medRes.rows[0].id;
            medName = medRes.rows[0].name;
            finalRack = medRes.rows[0].rack;
            finalShelf = medRes.rows[0].shelf;
            finalBox = medRes.rows[0].box;
        }

        // Insert new batch record
        await client.query(
            `INSERT INTO batches (medicine_id, received_qty, current_qty, expiry_date)
             VALUES ($1, $2, $2, $3)`,
            [medId, parsedQty, expiry_date]
        );

        // Add audit movement log
        await client.query(
            `INSERT INTO audit_logs (store_id, pharmacist_id, medication_name, action_type, qty_change)
             VALUES ($1, $2, $3, 'Inbound', $4)`,
            [store_id, pharmacist_id, medName, parsedQty]
        );

        await client.query('COMMIT');
        res.status(200).json({ 
            success: true, 
            message: `Successfully registered ${parsedQty} units of ${medName}.`,
            medicine: {
                sku: sku.toUpperCase().trim(),
                name: medName,
                rack: finalRack,
                shelf: finalShelf,
                box: finalBox
            }
        });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ success: false, message: 'Inbound intake registration failed.', error: err.message });
    } finally {
        client.release();
    }
};

// 3. Ledger Active Entries
exports.getLedger = async (req, res) => {
    const { store_id, filter } = req.body;

    if (!store_id) {
        return res.status(400).json({ success: false, message: 'Store ID required.' });
    }

    try {
        let sql = `
            SELECT m.*, COALESCE(SUM(b.current_qty), 0)::INT as qty,
                   MIN(CASE WHEN b.current_qty > 0 THEN b.expiry_date ELSE NULL END) as nearest_expiry
            FROM medicines m 
            LEFT JOIN batches b ON m.id = b.medicine_id 
            WHERE m.store_id = $1
            GROUP BY m.id
        `;
        const searchRes = await pool.query(sql, [store_id]);

        let meds = searchRes.rows.map(row => {
            const daysLeft = row.nearest_expiry ? getDaysRemaining(row.nearest_expiry) : 999;
            let status = 'Optimal';
            if (row.qty <= row.par_limit * 0.2) status = 'Critical';
            else if (row.qty <= row.par_limit * 0.5) status = 'Stable';

            return {
                sku: row.sku,
                name: row.name,
                category: row.category,
                qty: row.qty,
                rack: row.rack,
                shelf: row.shelf,
                box: row.box,
                par: row.par_limit,
                status: status,
                coldStorage: row.cold_storage,
                expiryDate: row.nearest_expiry ? new Date(row.nearest_expiry).toISOString().split('T')[0] : 'N/A',
                daysRemaining: daysLeft
            };
        });

        // Filter Logic
        if (filter === 'Critical') {
            meds = meds.filter(m => m.qty <= m.par * 0.2 || m.daysRemaining <= 0);
        } else if (filter === 'Expiry') {
            meds = meds.filter(m => m.daysRemaining <= 30);
        } else if (filter === 'Cold') {
            meds = meds.filter(m => m.coldStorage === true);
        }

        res.status(200).json({ success: true, medicines: meds });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Database ledger query failed.', error: err.message });
    }
};

// 4. Quick Restock Reorder
exports.reorderMedicine = async (req, res) => {
    const { store_id, pharmacist_id, sku } = req.body;

    if (!store_id || !pharmacist_id || !sku) {
        return res.status(400).json({ success: false, message: 'Restock parameter missing.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Find medicine template ID
        const medRes = await client.query(
            `SELECT id, name, par_limit FROM medicines WHERE store_id = $1 AND sku = $2`,
            [store_id, sku]
        );

        if (medRes.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Invalid SKU.' });
        }

        const medId = medRes.rows[0].id;
        const medName = medRes.rows[0].name;
        const restockQty = Math.ceil(medRes.rows[0].par_limit * 1.5);

        // Expiry set to 1 year ahead
        const expDate = new Date();
        expDate.setFullYear(expDate.getFullYear() + 1);
        const expStr = expDate.toISOString().split('T')[0];

        // Insert new batch record
        await client.query(
            `INSERT INTO batches (medicine_id, received_qty, current_qty, expiry_date)
             VALUES ($1, $2, $2, $3)`,
            [medId, restockQty, expStr]
        );

        // Add audit movement log
        await client.query(
            `INSERT INTO audit_logs (store_id, pharmacist_id, medication_name, action_type, qty_change)
             VALUES ($1, $2, $3, 'Inbound', $4)`,
            [store_id, pharmacist_id, medName, restockQty]
        );

        await client.query('COMMIT');
        res.status(200).json({ success: true, message: `Successfully restocked ${restockQty} units of ${medName}.` });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ success: false, message: 'Restock process failed.', error: err.message });
    } finally {
        client.release();
    }
};

// 5. Fetch Active Batches for a specific Medicine
exports.getMedicineBatches = async (req, res) => {
    const { store_id, sku } = req.body;

    if (!store_id || !sku) {
        return res.status(400).json({ success: false, message: 'Store ID and Medicine SKU are required.' });
    }

    try {
        const medRes = await pool.query(
            `SELECT id, name FROM medicines WHERE store_id = $1 AND sku = $2`,
            [store_id, sku]
        );

        if (medRes.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Medicine SKU not found.' });
        }

        const medId = medRes.rows[0].id;
        const batchesRes = await pool.query(
            `SELECT id, current_qty, expiry_date::TEXT FROM batches WHERE medicine_id = $1 AND current_qty > 0 ORDER BY expiry_date ASC`,
            [medId]
        );

        res.status(200).json({ 
            success: true, 
            medicine_name: medRes.rows[0].name, 
            batches: batchesRes.rows.map(b => ({
                id: b.id,
                current_qty: b.current_qty,
                expiry_date: b.expiry_date.split('T')[0]
            }))
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Database batch query failed.', error: err.message });
    }
};

// 6. Process Stock Outtake (atomic update and log logging)
exports.processOuttake = async (req, res) => {
    const { store_id, pharmacist_id, sku, batch_id, qty, reason } = req.body;

    if (!store_id || !pharmacist_id || !sku || !batch_id || !qty || !reason) {
        return res.status(400).json({ success: false, message: 'Required outtake parameters are incomplete.' });
    }

    const outtakeQty = parseInt(qty);
    if (isNaN(outtakeQty) || outtakeQty <= 0) {
        return res.status(400).json({ success: false, message: 'Outtake quantity must be greater than zero.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Fetch medicine & batch to verify ownership and stock levels
        const batchRes = await client.query(
            `SELECT b.id, b.current_qty, m.name as medicine_name 
             FROM batches b
             JOIN medicines m ON b.medicine_id = m.id
             WHERE b.id = $1 AND m.sku = $2 AND m.store_id = $3`,
            [batch_id, sku, store_id]
        );

        if (batchRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ success: false, message: 'Specific medicine batch not found.' });
        }

        const batch = batchRes.rows[0];

        // Stock validation
        if (batch.current_qty < outtakeQty) {
            await client.query('ROLLBACK');
            return res.status(400).json({ 
                success: false, 
                insufficient: true,
                message: 'Error: Insufficient stock available in this batch!' 
            });
        }

        // Decrement stock
        await client.query(
            `UPDATE batches SET current_qty = current_qty - $1 WHERE id = $2`,
            [outtakeQty, batch_id]
        );

        // Map reason code to allowed check constraint action_type ('Dispatched', 'Quarantined')
        let actionType = 'Quarantined';
        if (reason.toLowerCase().includes('dispatch') || reason.toLowerCase().includes('sale')) {
            actionType = 'Dispatched';
        } else if (reason.toLowerCase().includes('quarantine') || reason.toLowerCase().includes('damaged') || reason.toLowerCase().includes('recall')) {
            actionType = 'Quarantined';
        } else if (reason.toLowerCase().includes('expire') || reason.toLowerCase().includes('disposal')) {
            actionType = 'Quarantined';
        }

        // Insert audit log row with negative variance
        const negativeVariance = -outtakeQty;
        await client.query(
            `INSERT INTO audit_logs (store_id, pharmacist_id, medication_name, action_type, qty_change)
             VALUES ($1, $2, $3, $4, $5)`,
            [store_id, pharmacist_id, batch.medicine_name, actionType, negativeVariance]
        );

        await client.query('COMMIT');
        res.status(200).json({ 
            success: true, 
            message: `Successfully processed outtake of ${outtakeQty} units of ${batch.medicine_name}.`,
            updated_qty: batch.current_qty - outtakeQty
        });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ success: false, message: 'Stock outtake transaction failed.', error: err.message });
    } finally {
        client.release();
    }
};

// 7. Check Location Availability (Upgrade 2)
exports.checkLocationAvailability = async (req, res) => {
    const { store_id, rack, shelf, box, sku } = req.body;

    if (!store_id || !rack || !shelf || !box) {
        return res.status(400).json({ success: false, message: 'Store ID, rack, shelf, and box are required.' });
    }

    try {
        const cleanRack = rack.toUpperCase().trim();
        const cleanShelf = shelf.toUpperCase().trim();
        const cleanBox = box.toUpperCase().trim();

        let sql = `SELECT sku, name FROM medicines 
                   WHERE store_id = $1 
                     AND UPPER(TRIM(rack)) = $2 
                     AND UPPER(TRIM(shelf)) = $3 
                     AND UPPER(TRIM(box)) = $4`;
        const params = [store_id, cleanRack, cleanShelf, cleanBox];

        if (sku) {
            sql += ` AND sku <> $5`;
            params.push(sku.toUpperCase().trim());
        }

        const locationRes = await pool.query(sql, params);

        if (locationRes.rows.length > 0) {
            return res.status(200).json({ 
                success: false, 
                available: false, 
                occupiedByName: locationRes.rows[0].name,
                message: `Location Conflict! This shelf position is already allocated to ${locationRes.rows[0].name}.`
            });
        }

        res.status(200).json({ success: true, available: true, message: 'Location is available.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Database location check query failed.', error: err.message });
    }
};

// 8. Dispose and Quarantine all expired batches for a specific Medicine
exports.disposeExpiredStock = async (req, res) => {
    const { store_id, pharmacist_id, sku } = req.body;

    if (!store_id || !pharmacist_id || !sku) {
        return res.status(400).json({ success: false, message: 'Disposal parameters are incomplete.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Find medicine template ID
        const medRes = await client.query(
            `SELECT id, name FROM medicines WHERE store_id = $1 AND sku = $2`,
            [store_id, sku]
        );

        if (medRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ success: false, message: 'Invalid SKU.' });
        }

        const medId = medRes.rows[0].id;
        const medName = medRes.rows[0].name;

        // Find all expired batches with active quantity
        const expiredBatches = await client.query(
            `SELECT id, current_qty FROM batches 
             WHERE medicine_id = $1 AND current_qty > 0 AND expiry_date <= CURRENT_DATE`,
            [medId]
        );

        if (expiredBatches.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ success: false, message: 'No active expired batches found for this medicine.' });
        }

        let totalDisposed = 0;
        for (const batch of expiredBatches.rows) {
            totalDisposed += batch.current_qty;
            // Set current_qty to 0
            await client.query(
                `UPDATE batches SET current_qty = 0 WHERE id = $1`,
                [batch.id]
            );
        }

        // Add audit movement log (negative variance of quarantined stock)
        await client.query(
            `INSERT INTO audit_logs (store_id, pharmacist_id, medication_name, action_type, qty_change)
             VALUES ($1, $2, $3, 'Quarantined', $4)`,
            [store_id, pharmacist_id, medName, -totalDisposed]
        );

        await client.query('COMMIT');
        res.status(200).json({ 
            success: true, 
            message: `Successfully disposed ${totalDisposed} expired units of ${medName} from active store inventory.` 
        });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ success: false, message: 'Disposal transaction failed.', error: err.message });
    } finally {
        client.release();
    }
};
