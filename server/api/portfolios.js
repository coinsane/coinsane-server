const config = require('../../config');
const { mongo } = require('../../lib/db');
const { getTotals, getTotalsPct, getLastTotal } = require('../../lib/services/totals');

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
  const owner = req.user._id;
  const portfolio = req.query.portfolioId;
  const symbol = req.query.symbol || 'BTC';
  const range = req.query.range || '1d';

  const portfolioQuery = {
    owner,
    isActive: true
  };
  if (portfolio) {
    portfolioQuery._id = portfolio;
  }

  // TODO update response with a currency

  _getPortfolios(portfolioQuery)
    .then(portfolios => {
      return Promise.all(portfolios.map(portfolio => {
        return Promise.all([
          getTotalsPct(owner, portfolio._id, range),
          // getLastTotal(owner, portfolio._id),
        ])
        .then(all => {
          portfolio.changePct = all[0];
          // portfolio.amount = all[1];
          return portfolio;
        })
      }));
    })
    .then(portfolios => {
      return portfolios.map(portfolio => {
        portfolio.amount = 0;
        portfolio.coins.forEach(coin => {
          const amount = coin.market.symbol === 'BTC' ? coin.amount : coin.market.prices[symbol].price * coin.amount;
          portfolio.amount += amount;
        });
        return portfolio;
      });
    })
    .then(portfolios => {
      return res.send({
        success: true,
        response: {
          portfolios
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

const _getPortfolios = (portfolioQuery) => {
  return PortfolioModel
    .find(portfolioQuery, 'inTotal title')
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
             select: 'name symbol imageUrl prices.BTC.price prices.USD.price prices.RUB.price prices.BTC.changePctDay prices.USD.changePctDay prices.RUB.changePctDay',
           },
         ],
       },
    ])
    .then(portfolios => portfolios);
}

function updatePortfolios(req, res, next) {
  if (!req.body._id) {
    res.send({
      success: false,
      response: {
        message: '_id param is required'
      }
    });
    return next();
  }

  const query = {
    _id: req.body._id,
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

      portfolio.title = req.body.title;
      portfolio.inTotal = req.body.inTotal;

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
