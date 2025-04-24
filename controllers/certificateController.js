const { Certificate, Course, User, Lesson, Page, StudentProgress, Enrollment } = require('../models');

exports.generateCertificate = async (req, res) => {
  try {
    const { userId, courseId, score } = req.body;

    // 1️⃣ Check if the user is enrolled (optional but recommended)
    const enrollment = await Enrollment.findOne({ where: { userId, courseId } });
    if (!enrollment) {
      return res.status(403).json({ message: 'User is not enrolled in this course.' });
    }

    // 2️⃣ Check if all pages in the course are completed
    const totalPages = await Page.count({
      include: [{
        model: Lesson,
        where: { courseId }
      }]
    });

    const completedPages = await StudentProgress.count({
      where: {
        userId,
        courseId,
        isCompleted: true
      }
    });

    if (completedPages < totalPages) {
      return res.status(400).json({
        message: `Certificate cannot be generated. Student has completed only ${completedPages}/${totalPages} pages.`
      });
    }

    // 3️⃣ Generate Certificate
    const certificate = await Certificate.create({ userId, courseId, score });

    return res.status(201).json({
      message: 'Certificate generated successfully!',
      certificate
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error generating certificate', error });
  }
};

exports.getCertificate = async (req, res) => {
  try {
    const { userId, courseId } = req.params;

    const certificate = await Certificate.findOne({ 
      where: { userId, courseId },
      include: [
        { model: Course, attributes: ['title'] },
        { model: User, attributes: ['name'] }
      ]
    });

    if (!certificate) {
      return res.status(404).json({ message: "Certificate not found!" });
    }

    return res.status(200).json({ certificate });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Error fetching certificate", error });
  }
};
