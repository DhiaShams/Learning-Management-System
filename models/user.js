'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class User extends Model {
    static associate(models) {
      // Many-to-many: User <-> Course
      User.belongsToMany(models.Course, {
        through: models.Enrollment,
        foreignKey: 'userId',
        as: 'enrolledCourses',
      });

      // One-to-many: User -> Review
      User.hasMany(models.Review, {
        foreignKey: 'userId',
        as: 'reviews',
      });

      // One-to-many: User -> Doubt
      User.hasMany(models.Doubt, {
        foreignKey: 'userId',
        as: 'doubts',
      });

      // One-to-many: User -> Certificate
      User.hasMany(models.Certificate, {
        foreignKey: 'userId',
        as: 'certificates',
      });

      // One-to-many: User (educator) -> Course
      User.hasMany(models.Course, {
        foreignKey: 'educatorId',
        as: 'createdCourses',
      });

      // Completion relationships
      User.hasMany(models.PageCompletion, {
        as: "pageCompletions",
        foreignKey: "userId"
      });

      User.hasMany(models.LessonCompletion, {
        as: "lessonCompletions",
        foreignKey: "userId"
      });
    }
  }

  User.init({
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
    modelName: 'User',
    tableName: 'users', 
    timestamps: true,
  });

  return User;
};
