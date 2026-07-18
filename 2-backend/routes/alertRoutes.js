const express = require('express');
const router = express.Router();
const alertController = require('../controllers/alertController');
const sessionAuth = require('../middleware/sessionAuth');

// Dashboard statistics and active audit movement feed protected route
router.post('/dashboard', sessionAuth, alertController.getDashboardMetrics);

module.exports = router;
