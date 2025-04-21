const express = require('express');
const router = express.Router();
const certificateController = require('../controllers/certificateController');

router.post('/generate', certificateController.generateCertificate);
router.get('/:userId/:courseId', certificateController.getCertificate);

module.exports = router;
