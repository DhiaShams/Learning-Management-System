const { Lesson, Course } = require('../models');

exports.createLesson = async (req, res) => {
    try {
        const { courseId, title } = req.body;

        // Verify course exists
        const course = await Course.findByPk(courseId);
        if (!course) {
            return res.status(404).json({ message: 'Course not found' });
        }

        // Create Lesson
        const newLesson = await Lesson.create({ courseId, title });
        res.status(201).json({ message: 'Lesson created successfully', lesson: newLesson });

    } catch (error) {
        console.error('Error creating lesson:', error);
        res.status(500).json({ message: 'Error creating lesson', error: error.message });
    }
};

exports.getLessonsByCourse = async (req, res) => {
    try {
        const { courseId } = req.params;

        const lessons = await Lesson.findAll({
            where: { courseId }
        });

        res.status(200).json({ lessons });
    } catch (error) {
        console.error('Error fetching lessons:', error);
        res.status(500).json({ message: 'Error fetching lessons', error: error.message });
    }
};
