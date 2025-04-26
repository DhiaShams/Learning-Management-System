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
      // define association here
      Course.belongsTo(models.User, {
        foreignKey: 'educatorId', 
        as: 'educator',   
      });

      Course.hasMany(models.Enrollment, { foreignKey: 'courseId' });

      // A Course can have many Reviews
      Course.hasMany(models.Review, {
        foreignKey: 'courseId',
        as: 'reviews', // Alias for reviews
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