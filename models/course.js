'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Course extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // A Course belongs to an Educator (User)
      Course.belongsTo(models.User, {
        foreignKey: 'educatorId',
        as: 'educator',
      });
    
      // A Course has many Enrollments
      Course.hasMany(models.Enrollment, {
        foreignKey: 'courseId',
        as: 'enrollments',
      });
    
      // A Course has many Students through Enrollments
      Course.belongsToMany(models.User, {
        through: models.Enrollment,
        as: 'enrolledStudents',
        foreignKey: 'courseId',
        otherKey: 'userId',
      });

      // A Course has many Doubts
      Course.hasMany(models.Doubt, {
        foreignKey: 'courseId',
        as: 'doubts',
      });
    
      // A Course has many Lessons
      Course.hasMany(models.Lesson, {
        foreignKey: 'courseId',
        as: 'lessons',
        onDelete: 'CASCADE',
      });
    
      // A Course can have many Reviews
      Course.hasMany(models.Review, {
        foreignKey: 'courseId',
        as: 'reviews',
      });
    }
  }
  Course.init({
    title: DataTypes.STRING,
    description: DataTypes.TEXT,
    educatorId: DataTypes.INTEGER
  }, {
    sequelize,
    modelName: 'Course',
  });
  return Course;
};