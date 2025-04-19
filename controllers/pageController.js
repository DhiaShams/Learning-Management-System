const { Page, Lesson } = require('../models');

exports.createPage = async (req, res) => {
    try {
        const { lessonId, title, content } = req.body;

        // Verify lesson exists
        const lesson = await Lesson.findByPk(lessonId);
        if (!lesson) {
            return res.status(404).json({ message: 'Lesson not found' });
        }

        // Create Page
        const newPage = await Page.create({ lessonId, title, content });
        res.status(201).json({ message: 'Page created successfully', page: newPage });

    } catch (error) {
        console.error('Error creating page:', error);
        res.status(500).json({ message: 'Error creating page', error: error.message });
    }
};

exports.getPagesByLesson = async (req, res) => {
    try {
        const { lessonId } = req.params;

        const pages = await Page.findAll({
            where: { lessonId }
        });

        res.status(200).json({ pages });
    } catch (error) {
        console.error('Error fetching pages:', error);
        res.status(500).json({ message: 'Error fetching pages', error: error.message });
    }
};
