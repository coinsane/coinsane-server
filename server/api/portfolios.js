const config = require('../../config');
const { mongo } = require('../../lib/db');

const { PortfolioModel } = mongo();

function postPortfolios(req, res, next) {
  const newPortfolio = new PortfolioModel({
    owner: req.user._id,
    ...req.body
  });
  newPortfolio.save()
    .then(portfolio => {
      return res.send({
        success: true,
        response: {
          portfolio: portfolio
        }
      });
    })
    .then(next)
    .catch(err => {
      return res.send({
        success: false,
        response: {
          message: err
        }
      });
    });
}

function getPortfolios(req, res, next) {
  const query = {
    owner: req.user._id,
    isActive: true
  };
  if (req.query.portfolioId) query._id = req.query.portfolioId;

  PortfolioModel
    .find(query, 'inTotal title')
    .populate([
      {
         path: 'coins',
         model: 'Coin',
         match: { isActive: true },
         select: 'amount',
         populate: [
           {
             path: 'market',
             model: 'Market',
             select: 'name symbol prices.BTC.price prices.USD.price prices.RUB.price',
           },
         ],
       },
    ])
    .then(portfolios => {
      return res.send({
        success: true,
        response: {
          portfolios: portfolios
        }
      });
    })
    .then(next)
    .catch(err => {
      return res.send({
        success: false,
        response: {
          message: err
        }
      });
    });
}

function updatePortfolios(req, res, next) {
  if (!req.body.portfolioId) {
    res.send({
      success: false,
      response: {
        message: 'portfolioId param is required'
      }
    });
    return next();
  }

  const query = {
    _id: req.body.portfolioId,
    owner: req.user._id
  };

  PortfolioModel
    .findOne(query)
    .then(portfolio => {
      if (!portfolio) {
        res.send({
          success: false,
          response: {
            message: 'portfolio not found'
          }
        });
        return next();
      }

      if (req.body.title) portfolio.title = req.body.title;
      if (req.body.inTotal) portfolio.inTotal = req.body.inTotal;

      return portfolio.save()
        .then(updatedPortfolio => {
          return res.send({
            success: true,
            response: {
              portfolio: updatedPortfolio
            }
          });
        });
    })
    .then(next)
    .catch(err => {
      res.send({
        success: false,
        response: {
          message: err
        }
      });
    });
}

function delPortfolios(req, res, next) {
  if (!req.body.portfolioId) {
    res.send({
      success: false,
      response: {
        message: 'portfolioId param is required'
      }
    });
    return next();
  }

  const query = {
    _id: req.body.portfolioId,
    owner: req.user._id
  };

  PortfolioModel
    .findOne(query)
    .then(portfolio => {
      if (!portfolio) {
        res.send({
          success: false,
          response: {
            message: 'portfolio not found'
          }
        });
        return next();
      }

      portfolio.isActive = false;

      return portfolio.save()
        .then(() => {
          return res.send({
            success: true,
            response: {
              portfolioId: portfolio._id
            }
          });
        })
    })
    .then(next)
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
  postPortfolios,
  getPortfolios,
  updatePortfolios,
  delPortfolios,
};
