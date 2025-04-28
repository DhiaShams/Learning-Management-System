'use strict';
const {
  Model
} = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class User extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // A User can enroll in many Courses (many-to-many relationship)
      User.belongsToMany(models.Course, {
        through: models.Enrollment,  // Associating via the Enrollment table
        foreignKey: 'userId',
        as: 'enrolledCourses',
      });

      // A User can leave reviews for many Courses (one-to-many relationship)
      User.hasMany(models.Review, {
        foreignKey: 'userId',
        as: 'reviews',
      });

      // A User can ask many Doubts (one-to-many relationship)
      User.hasMany(models.Doubt, {
        foreignKey: 'userId',
        as: 'doubts',
      });

      // A User can receive many Certificates (one-to-many relationship)
      User.hasMany(models.Certificate, {
        foreignKey: 'userId',
        as: 'certificates',
      });

      // A User (educator) can create many Courses (one-to-many relationship)
      User.hasMany(models.Course, {
          foreignKey: 'educatorId',
          as: 'createdCourses', 
      });

      User.hasMany(models.PageCompletion, { as: "pageCompletions", foreignKey: "userId" });
      User.hasMany(models.LessonCompletion, { as: "lessonCompletions", foreignKey: "userId" });
    }
  }

  User.init({
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING,
      unique: true,  // Ensure email is unique
      allowNull: false,
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    role: {
      type: DataTypes.STRING,
      defaultValue: 'student', // Default role is student, can be overridden for educators
      allowNull: false,
    },
  }, {
    sequelize,
    modelName: 'User',
  });

  return User;
};
