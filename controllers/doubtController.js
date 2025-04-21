const { Doubt, User, Course, Lesson, Page } = require('../models');

exports.postDoubt = async (req, res) => {
  try {
    const { userId, courseId, lessonId, pageId, questionText } = req.body;

    const doubt = await Doubt.create({
      userId, courseId, lessonId, pageId, questionText
    });

    return res.status(201).json({ message: 'Doubt posted successfully.', doubt });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Error posting doubt.', error });
  }
};

exports.getDoubts = async (req, res) => {
  try {
    const { courseId } = req.params;

    const doubts = await Doubt.findAll({
      where: { courseId },
      include: [
        { model: User, attributes: ['name', 'email'] },
        { model: Lesson, attributes: ['title'] },
        { model: Page, attributes: ['title'] }
      ]
    });

    return res.status(200).json({ doubts });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Error fetching doubts.', error });
  }
};

exports.answerDoubt = async (req, res) => {
  try {
    const { doubtId } = req.params;
    const { answerText } = req.body;

    const doubt = await Doubt.findByPk(doubtId);
    if (!doubt) return res.status(404).json({ message: 'Doubt not found.' });

    doubt.answerText = answerText;
    doubt.isResolved = true;
    await doubt.save();

    return res.status(200).json({ message: 'Doubt answered successfully.', doubt });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Error answering doubt.', error });
  }
};
