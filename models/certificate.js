'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Certificate extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    Certificate.belongsTo(models.User, { foreignKey: 'userId', as: 'student' });
    Certificate.belongsTo(models.Course, { foreignKey: 'courseId', as: 'course' });
    }
  }
  Certificate.init({
    userId: DataTypes.INTEGER,
    courseId: DataTypes.INTEGER,
    score: DataTypes.INTEGER,
    filePath: DataTypes.STRING, // Add this field to store the file path
  }, {
    sequelize,
    modelName: 'Certificate',
  });
  return Certificate;
};