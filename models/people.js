'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class People extends Model {
    static associate(models) {
      // Many-to-many: People <-> Course
      People.belongsToMany(models.Course, {
        through: models.Enrollment,
        foreignKey: 'userId',
        as: 'enrolledCourses',
      });

      // One-to-many: People -> Review
      People.hasMany(models.Review, {
        foreignKey: 'userId',
        as: 'reviews',
      });

      // One-to-many: People -> Doubt
      People.hasMany(models.Doubt, {
        foreignKey: 'userId',
        as: 'doubts',
      });

      // One-to-many: People -> Certificate
      People.hasMany(models.Certificate, {
        foreignKey: 'userId',
        as: 'certificates',
      });

      // One-to-many: People (educator) -> Course
      People.hasMany(models.Course, {
        foreignKey: 'educatorId',
        as: 'createdCourses',
      });

      // Completion relationships
      People.hasMany(models.PageCompletion, {
        as: "pageCompletions",
        foreignKey: "userId"
      });

      People.hasMany(models.LessonCompletion, {
        as: "lessonCompletions",
        foreignKey: "userId"
      });
    }
  }

  People.init({
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: false,
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    role: {
      type: DataTypes.STRING,
      defaultValue: 'student',
      allowNull: false,
    },
  }, {
    sequelize,
    modelName: 'People', // Changed from 'User' to 'People'
    tableName: 'People',
    timestamps: true,
  });

  return People;
};