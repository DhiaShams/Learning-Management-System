'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Enrollment extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      Enrollment.belongsTo(models.User, { foreignKey: 'userId' });
      Enrollment.belongsTo(models.Course, { foreignKey: 'courseId' });
    }
  }
  
  Enrollment.init({
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: 'enrollment_unique_constraint',
    },
    courseId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: 'enrollment_unique_constraint',
    },
    enrolledAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      allowNull: false
    }
  },{
    sequelize,
    modelName: 'Enrollment',
  });
  return Enrollment;
};