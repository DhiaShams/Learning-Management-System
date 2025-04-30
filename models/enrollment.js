'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Enrollment extends Model {
    static associate(models) {
      Enrollment.belongsTo(models.User, {
        foreignKey: 'userId',
        as: 'student',
      });
      Enrollment.belongsTo(models.Course, {
        foreignKey: 'courseId',
        as: 'course',
      });
    }
  }
  Enrollment.init({
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    userId: DataTypes.INTEGER,
    courseId: DataTypes.INTEGER,
  }, {
    sequelize,
    modelName: 'Enrollment',
  });
  return Enrollment;
};