'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class StudentProgress extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      StudentProgress.belongsTo(models.People, { foreignKey: 'userId' });
      StudentProgress.belongsTo(models.Course, { foreignKey: 'courseId' });
      StudentProgress.belongsTo(models.Lesson, { foreignKey: 'lessonId' });
      StudentProgress.belongsTo(models.Page, { foreignKey: 'pageId' });
    }
  }
  StudentProgress.init({
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    courseId: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    lessonId: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    pageId: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    isCompleted: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    }
  }, {
    sequelize,
    modelName: 'StudentProgress',
  });
  return StudentProgress;
};