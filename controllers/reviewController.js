const { Review, User, Course } = require('../models');

exports.createReview = async (req, res) => {
  try {
    const { userId, courseId, rating, comment } = req.body;

    // Check if the user is enrolled
    const enrollment = await require('../models').Enrollment.findOne({ where: { userId, courseId } });
    if (!enrollment) {
      return res.status(403).json({ message: 'You must be enrolled to leave a review.' });
    }

    // Create review
    const review = await Review.create({ userId, courseId, rating, comment });
    return res.status(201).json({ message: 'Review submitted!', review });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error submitting review', error });
  }
};

exports.getCourseReviews = async (req, res) => {
  try {
    const { courseId } = req.params;

    const reviews = await Review.findAll({
      where: { courseId },
      include: [{ model: require('../models').User, attributes: ['name'] }]
    });

    return res.status(200).json({ reviews });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error fetching reviews', error });
  }
};
