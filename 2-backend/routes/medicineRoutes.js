const express = require('express');
const router = express.Router();
const medicineController = require('../controllers/medicineController');
const sessionAuth = require('../middleware/sessionAuth');

// Apply sessionAuth gatekeeper middleware to all medicine endpoints
router.post('/search', sessionAuth, medicineController.searchMedicines);
router.post('/intake', sessionAuth, medicineController.processIntake);
router.post('/ledger', sessionAuth, medicineController.getLedger);
router.post('/ledger/reorder', sessionAuth, medicineController.reorderMedicine);
router.post('/ledger/dispose-expired', sessionAuth, medicineController.disposeExpiredStock);
router.post('/batches', sessionAuth, medicineController.getMedicineBatches);
router.post('/outtake', sessionAuth, medicineController.processOuttake);
router.post('/check-location', sessionAuth, medicineController.checkLocationAvailability);

// Expose standard API endpoint for direct medicine addition with robust validations
router.post('/medicines/add', medicineController.processIntake);

module.exports = router;
