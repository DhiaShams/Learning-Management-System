const express = require('express');
const router = express.Router();
const progressController = require('../controllers/progressController');

// Route to track progress (update or create)
router.post('/track', progressController.trackProgress);

// Route to fetch a student's progress
router.get('/:userId', progressController.getStudentProgress);

module.exports = router;
