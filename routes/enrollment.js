const express = require('express');
const router = express.Router();
const enrollmentController = require('../controllers/enrollmentController');

// Route to enroll a student in a course
router.post('/enroll', enrollmentController.enrollStudentInCourse);

// Route to get courses the student is enrolled in
router.get('/student/:userId/courses', enrollmentController.getStudentCourses);

module.exports = router;
