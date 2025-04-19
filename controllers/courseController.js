const { Course } = require('../models');

const createCourse = async (req, res) => {
    try {
        const { title, description, educatorId } = req.body;

        const newCourse = await Course.create({
            title,
            description,
            educatorId
        });

        res.status(201).json({
            message: 'Course created successfully!',
            course: newCourse
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error creating course', error });
    }
};

module.exports = { createCourse };
