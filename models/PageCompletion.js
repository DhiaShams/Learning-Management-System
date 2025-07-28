module.exports = (sequelize, DataTypes) => {
  const PageCompletion = sequelize.define("PageCompletion", {
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    pageId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  });

  // Define associations
  PageCompletion.associate = (models) => {
    PageCompletion.belongsTo(models.Page, { as: "page", foreignKey: "pageId" });
    PageCompletion.belongsTo(models.People, { as: "user", foreignKey: "userId" });
  };

  return PageCompletion;
};