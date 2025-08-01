'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Doubt extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      Doubt.belongsTo(models.Course, { foreignKey: 'courseId', as: 'course' });     
      Doubt.belongsTo(models.Lesson, { foreignKey: 'lessonId' });     
      Doubt.belongsTo(models.Page, { foreignKey: "pageId", as: "page" }); // Associate with Page
      Doubt.belongsTo(models.People, { foreignKey: "userId", as: "student" }); // Associate with User         
    }
  }
  Doubt.init({
    userId: { type: DataTypes.INTEGER, allowNull: false },
    courseId: { type: DataTypes.INTEGER, allowNull: false },
    lessonId: { type: DataTypes.INTEGER, allowNull: true },
    pageId: { type: DataTypes.INTEGER, allowNull: true },
    questionText: { type: DataTypes.TEXT, allowNull: false },
    answerText: { type: DataTypes.TEXT, allowNull: true },
    isResolved: { type: DataTypes.BOOLEAN, defaultValue: false }
  }, {
    sequelize,
    modelName: 'Doubt',
  });
  return Doubt;
};