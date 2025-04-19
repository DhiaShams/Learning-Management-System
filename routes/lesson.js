const express = require('express');
const router = express.Router();
const lessonController = require('../controllers/lessonController');

router.post('/', lessonController.createLesson); // Create lesson
router.get('/course/:courseId', lessonController.getLessonsByCourse); // List lessons for course

module.exports = router;
