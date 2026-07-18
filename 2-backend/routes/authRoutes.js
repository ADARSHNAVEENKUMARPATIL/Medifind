const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const rateLimiter = require('../middleware/rateLimiter');

// Protect authentication routes (max 5 requests per 15-minute rolling window)
const authRateLimiter = rateLimiter(5, 15 * 60 * 1000);

// 1. Store & Admin Pharmacist Registration Wizard Route
router.post('/register', authRateLimiter, authController.registerStore);

// 2. Terminal Console Authentication Sign-In Route
router.post('/login', authRateLimiter, authController.loginPharmacist);

module.exports = router;
