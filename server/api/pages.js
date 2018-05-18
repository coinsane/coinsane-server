const { mongo } = require('../../lib/db');

const { PageModel } = mongo();

function getPages(req, res, next) {
  const pageData = {
    locale: 'en',
  };

  PageModel.find(pageData, 'name title content')
    .then(data => {
      if (!data || !data.length) {
        return res.send({
          success: false,
          message: 'no pages found'
        });
      }
      res.send({
        success: true,
        time: new Date(),
        data: pagesArrayToObj(data),
      });
    });
}

function pagesArrayToObj(pages) {
  let pagesObj = {};
  pages.forEach(page => {
    pagesObj[page.name] = {
      title: page.title,
      content: page.content,
    };
  });
  return pagesObj;
}

function getPage(req, res, next) {
  const pageData = {
    name: req.params.name,
    locale: 'en',
  };

  PageModel.findOne(pageData, 'title content')
    .then(data => {
      if (!data) {
        return res.send({
          success: false,
          message: 'page not found'
        });
      }
      res.send({
        success: true,
        time: new Date(),
        data,
      });
    });
}

module.exports = {
  getPages,
  getPage,
};
