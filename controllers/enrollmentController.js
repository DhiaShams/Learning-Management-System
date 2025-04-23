const { Enrollment, User, Course } = require('../models');

// Enroll a student in a course
exports.enrollStudentInCourse = async (req, res) => {
  try {
    const { userId, courseId } = req.body;

    // Check if the user exists
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found!' });
    }

    // Check if the course exists
    const course = await Course.findByPk(courseId);
    if (!course) {
      return res.status(404).json({ message: 'Course not found!' });
    }

    // Check if the student is already enrolled
    const existingEnrollment = await Enrollment.findOne({
      where: { userId, courseId }
    });
    if (existingEnrollment) {
      return res.status(400).json({ message: 'Student is already enrolled in this course.' });
    }

    console.log('Enrollment body:', req.body);
    console.log('userId:', userId, 'courseId:', courseId);
    // Enroll the student in the course
    const enrollment = await Enrollment.create({
      userId,
      courseId,
      CourseId:courseId,
      enrolledAt: new Date()
    });
    return res.status(200).json({
      message: 'Enrollment successful!',
      enrollment
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Error enrolling student in course', error });
  }
};

// Get all courses the student is enrolled in
exports.getStudentCourses = async (req, res) => {
  try {
    const { userId } = req.params;

    // Get all courses that the student is enrolled in
    const enrollments = await Enrollment.findAll({
      where: { userId },
      include: [{ model: Course, attributes: ['id', 'title'] }]
    });

    if (!enrollments.length) {
      return res.status(404).json({ message: 'Student is not enrolled in any courses.' });
    }

    return res.status(200).json({ courses: enrollments.map(enrollment => enrollment.Course) });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Error fetching student courses', error });
  }
};
