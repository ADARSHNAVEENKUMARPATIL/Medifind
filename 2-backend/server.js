require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

// Security Hardening: Disable information disclosure headers and enforce secure options
app.disable('x-powered-by');
app.use((req, res, next) => {
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'no-referrer-when-downgrade');
    next();
});

// Enable CORS and request parsers
app.use(cors());
app.use(express.json());

// Import Modular Route Modules
const authRoutes = require('./routes/authRoutes');
const medicineRoutes = require('./routes/medicineRoutes');
const alertRoutes = require('./routes/alertRoutes');

// Mount API routes under /api (preserving backward compatibility with frontends)
app.use('/api', authRoutes);
app.use('/api', medicineRoutes);
app.use('/api', alertRoutes);

// Serve frontend static assets from '1-frontend' directory
app.use(express.static(path.join(__dirname, '../1-frontend')));

// Root redirect: automatically send users from / to /pages/welcome.html
app.get('/', (req, res) => {
    res.redirect('/pages/welcome.html');
});

// Fallback HTML page server handler: serve welcome.html
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../1-frontend/pages/welcome.html'));
});

// Start Express server engine
app.listen(PORT, () => {
    console.log(`🚀 MediFind Clinical OS Backend Service running on port ${PORT}`);
    console.log(`📂 Static assets served securely from 1-frontend/`);
    console.log(`🌐 Open http://localhost:${PORT} in your web browser.`);
});
