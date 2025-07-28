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

  // Define associations
  LessonCompletion.associate = (models) => {
    LessonCompletion.belongsTo(models.Lesson, { as: "lesson", foreignKey: "lessonId" });
    LessonCompletion.belongsTo(models.People, { as: "user", foreignKey: "userId" });
  };

  return LessonCompletion;
};