'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Page extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      Page.belongsTo(models.Lesson, { foreignKey: 'lessonId',as: 'lesson', onDelete: 'CASCADE' });
      Page.hasMany(models.PageCompletion, { as: "completions", foreignKey: "pageId" });
      Page.hasMany(models.Doubt, { foreignKey: 'pageId', as: 'doubts' });
    }
  }
  Page.init({
    title: {
      type: DataTypes.STRING,
      allowNull: false
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    lessonId: {
      type: DataTypes.INTEGER,
      allowNull: false
    }
  }, {
    sequelize,
    modelName: 'Page',
  });
  return Page;
};