const express = require('express');
const router = express.Router();
const studentController = require('../controllers/studentController');

// Signup Route
router.post('/signup', studentController.registerStudent);

// Login Route
router.post('/login', studentController.loginStudent);

module.exports = router;
