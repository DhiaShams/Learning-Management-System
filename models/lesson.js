'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Lesson extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      Lesson.belongsTo(models.Course, { foreignKey: 'courseId',  as: 'course',onDelete: 'CASCADE' });
      Lesson.hasMany(models.Page, { foreignKey: 'lessonId',as: 'pages', onDelete: 'CASCADE' });
    }
  }
  Lesson.init({
    title: {
      type: DataTypes.STRING,
      allowNull: false
    },
    courseId: {
      type: DataTypes.INTEGER,
      allowNull: false
    }
  }, {
    sequelize,
    modelName: 'Lesson',
  });
  return Lesson;
};