module.exports = (sequelize, DataTypes) => {
    const CourseCompletion = sequelize.define("CourseCompletion", {
      userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      courseId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
    });
    return CourseCompletion;
  };
  