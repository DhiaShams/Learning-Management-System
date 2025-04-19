const express = require('express');
const router = express.Router();
const educatorController = require('../controllers/educatorController');

// Signup Route
router.post('/signup', educatorController.registerEducator);

// Login Route
router.post('/login', educatorController.loginEducator);

module.exports = router;
