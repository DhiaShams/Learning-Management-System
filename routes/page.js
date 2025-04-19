const express = require('express');
const router = express.Router();
const pageController = require('../controllers/pageController');

router.post('/', pageController.createPage); // Create page
router.get('/lesson/:lessonId', pageController.getPagesByLesson); // List pages for lesson

module.exports = router;
