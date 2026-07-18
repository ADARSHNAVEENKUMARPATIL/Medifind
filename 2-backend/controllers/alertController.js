const pool = require('../config/db');

// Helper: Extract Initials from Full Name
function getInitials(name) {
    if (!name) return 'Sys';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 3);
}

// Helper: Format Time string HH:MM:SS
function formatTime(date) {
    return new Date(date).toTimeString().split(' ')[0];
}

exports.getDashboardMetrics = async (req, res) => {
    const { store_id } = req.body;

    if (!store_id) {
        return res.status(400).json({ success: false, message: 'Store ID required.' });
    }

    try {
        // A. Total medicines count
        const medRes = await pool.query('SELECT COUNT(*) FROM medicines WHERE store_id = $1', [store_id]);
        const totalMeds = parseInt(medRes.rows[0].count);

        // B. Expired count
        const expiredRes = await pool.query(
            `SELECT COUNT(DISTINCT b.id) 
             FROM batches b 
             JOIN medicines m ON b.medicine_id = m.id 
             WHERE m.store_id = $1 AND b.current_qty > 0 AND b.expiry_date <= CURRENT_DATE`,
            [store_id]
        );
        const expiredCount = parseInt(expiredRes.rows[0].count);

        // C. Low stock count (current_qty sum <= 20% par_limit)
        const lowRes = await pool.query(
            `SELECT COUNT(*) 
             FROM medicines m 
             LEFT JOIN (
                 SELECT medicine_id, SUM(current_qty) as total_qty 
                 FROM batches 
                 GROUP BY medicine_id
             ) b ON m.id = b.medicine_id 
             WHERE m.store_id = $1 AND COALESCE(b.total_qty, 0) <= m.par_limit * 0.2`,
            [store_id]
        );
        const lowStockCount = parseInt(lowRes.rows[0].count);

        // D. Cold Storage active count
        const coldRes = await pool.query(
            `SELECT COUNT(*) FROM medicines WHERE store_id = $1 AND cold_storage = TRUE`,
            [store_id]
        );
        const coldCount = parseInt(coldRes.rows[0].count);

        // E. 5 Recent Logs
        const logsRes = await pool.query(
            `SELECT l.timestamp, l.medication_name, l.action_type, l.qty_change, p.full_name 
             FROM audit_logs l 
             JOIN pharmacists p ON l.pharmacist_id = p.id 
             WHERE l.store_id = $1 
             ORDER BY l.timestamp DESC LIMIT 5`,
            [store_id]
        );

        const logs = logsRes.rows.map(row => {
            const val = row.qty_change;
            const prefix = val >= 0 ? '+' : '';
            return {
                time: formatTime(row.timestamp),
                name: row.medication_name,
                type: row.action_type,
                qty: `${prefix}${val.toLocaleString()}`,
                operator: row.full_name,
                opInitials: getInitials(row.full_name)
            };
        });

        // F. Expiring (<= 30 days) or Expired batches query
        const expiringRes = await pool.query(
            `SELECT b.id, m.name, m.sku, b.current_qty, b.expiry_date::TEXT
             FROM batches b
             JOIN medicines m ON b.medicine_id = m.id
             WHERE m.store_id = $1 AND b.current_qty > 0 
               AND b.expiry_date <= CURRENT_DATE + INTERVAL '30 days'
             ORDER BY b.expiry_date ASC`,
            [store_id]
        );

        // G. Low stock medicines query (total quantity across batches < 30)
        const lowStockRes = await pool.query(
            `SELECT m.sku, m.name, COALESCE(SUM(b.current_qty), 0)::INT as total_qty
             FROM medicines m
             LEFT JOIN batches b ON m.id = b.medicine_id
             WHERE m.store_id = $1
             GROUP BY m.id
             HAVING COALESCE(SUM(b.current_qty), 0) < 30
             ORDER BY total_qty ASC`,
            [store_id]
        );

        const urgentNotices = [];

        // Process expiring and expired batches
        expiringRes.rows.forEach(row => {
            const expiryDate = new Date(row.expiry_date);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const isExpired = expiryDate <= today;
            
            const rawDate = row.expiry_date.split('T')[0];
            let message = "";
            if (isExpired) {
                message = `Batch #${row.id} (${row.name}) - EXPIRED - Quarantine immediate stock (${row.current_qty} units).`;
            } else {
                const diffDays = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));
                message = `Batch #${row.id} (${row.name}) - EXPIRING SOON in ${diffDays} days (${rawDate}) - Clearance required (${row.current_qty} units left).`;
            }
            urgentNotices.push({
                type: 'critical',
                text: message
            });
        });

        // Process low stock medicines (< 30 units)
        lowStockRes.rows.forEach(row => {
            const message = `Stock Alert: ${row.name} (${row.sku}) is CRITICALLY LOW - Only ${row.total_qty} units remaining (Threshold < 30).`;
            urgentNotices.push({
                type: 'warning',
                text: message
            });
        });

        // Add default notice if no warnings exist
        if (urgentNotices.length === 0) {
            urgentNotices.push({
                type: 'info',
                text: 'All store medication levels are stable. No active stockouts or expirations recorded.'
            });
        }

        res.status(200).json({
            success: true,
            metrics: {
                totalMedicines: totalMeds,
                expiredAlerts: expiredCount,
                lowStockAlerts: lowStockCount,
                coldChainActive: coldCount,
                logs: logs,
                urgentNotices: urgentNotices
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Database statistics fetch error.', error: err.message });
    }
};
