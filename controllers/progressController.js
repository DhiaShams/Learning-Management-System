const { StudentProgress, Page, User, Lesson, Course} = require('../models');

exports.trackProgress = async (req, res) => {
  try {
    const { userId, courseId, lessonId, pageId, isCompleted } = req.body;

    // Check if the user exists
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found!' });
    }

    // Check if the page exists
    const page = await Page.findByPk(pageId);
    if (!page) {
      return res.status(404).json({ message: 'Page not found!' });
    }

    // Check if this progress entry exists for the user
    let progress = await StudentProgress.findOne({ where: { userId, courseId, lessonId, pageId } });
    
    // If it doesn't exist, create a new progress entry
    if (!progress) {
      progress = await StudentProgress.create({ userId, courseId, lessonId, pageId, isCompleted });
    } else {
      // Update progress if it exists
      progress.isCompleted = isCompleted;
      await progress.save();
    }

    return res.status(200).json({ message: 'Progress updated successfully', progress });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Error updating progress', error });
  }
};

exports.getStudentProgress = async (req, res) => {
  try {
    const { userId } = req.params;

    // Fetch the student's progress for all courses, lessons, and pages
    const progressData = await StudentProgress.findAll({
      where: { userId },
      include: [
        { model: Course, attributes: ['title'] },
        { model: Lesson, attributes: ['title'] },
        { model: Page, attributes: ['title'] }
      ]
    });

    if (!progressData.length) {
      return res.status(404).json({ message: 'No progress found for this student' });
    }

    return res.status(200).json({ progress: progressData });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Error fetching progress data', error });
  }
};
