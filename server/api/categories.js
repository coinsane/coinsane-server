const config = require('../../config');
const { mongo } = require('../../lib/db');

const { CategoryModel } = mongo();

function getCategories(req, res, next) {
  const categoryData = {
    owner: req.user._id,
    isActive: true,
  };

  CategoryModel.find(categoryData, 'title color')
    .then(categories => {
      if (!categories) {
        return res.send({
          success: false,
          message: 'categories not found'
        });
      }
      res.send({
        success: true,
        time: new Date(),
        categories,
      });
    });
}

function updateCategory(req, res, next) {
  res.send({
    success: false,
    response: {
      message: 'not ready yet'
    }
  });
}

function delCategory(req, res, next) {
  if (!req.body.categoryId) {
    res.send({
      success: false,
      response: {
        message: 'categoryId param is required'
      }
    });
    return next();
  }

  const query = {
    _id: req.body.categoryId,
    owner: req.user._id
  };

  CategoryModel
    .findOne(query)
    .then(category => {
      if (!category) {
        return res.send({
          success: false,
          response: {
            message: 'category not found'
          }
        });
      }

      category.isActive = false;

      return category.save()
        .then(() => {
          return res.send({
            success: true,
            response: {
              categoryId: category._id
            }
          });
        });
    })
    .catch(err => {
      res.send({
        success: false,
        response: {
          message: err
        }
      });
    });
}

module.exports = {
  getCategories,
  updateCategory,
  delCategory,
};
