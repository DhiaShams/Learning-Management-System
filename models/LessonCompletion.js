module.exports = (sequelize, DataTypes) => {
    const LessonCompletion = sequelize.define("LessonCompletion", {
      userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      lessonId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
    });
    return LessonCompletion;
  };
  