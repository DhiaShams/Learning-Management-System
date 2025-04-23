'use strict';
const {Model} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Enrollment extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // Define association with User
      Enrollment.belongsTo(models.User, {
        foreignKey: 'userId', // Explicitly define foreign key
        targetKey: 'id'
      });

      // Define association with Course
      Enrollment.belongsTo(models.Course, {
        foreignKey: 'courseId', // Explicitly define foreign key
        targetKey: 'id'
      });
    }
  }
  
  Enrollment.init({
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: 'enrollment_unique_constraint', // Composite unique constraint
      field: 'userId' // Explicitly map to userId column
    },
    courseId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: 'enrollment_unique_constraint', // Composite unique constraint
      field: 'courseId' // Explicitly map to courseId column
    },
    enrolledAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      allowNull: false
    }
  }, {
    sequelize,
    modelName: 'Enrollment',
    tableName: 'Enrollments', // Explicitly define table name
  });

  return Enrollment;
};