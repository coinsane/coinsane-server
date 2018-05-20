const { mongo } = require('../../lib/db');
const { getTotalsPct } = require('../../lib/services/totals');
const { price } = require('../../lib/services/cryptocompare');

const { PortfolioModel } = mongo();

const BTC = 'BTC';

function postPortfolios(req, res) {
  const newPortfolio = new PortfolioModel({
    owner: req.user._id,
    ...req.body,
  });
  return newPortfolio.save()
    .then(portfolio => {
      return res.send({
        success: true,
        response: {
          portfolio: portfolio,
        },
      });
    })
    .catch(err => {
      return res.send({
        success: false,
        response: {
          message: err,
        },
      });
    });
}

function getPortfolios(req, res) {
  const owner = req.user._id;
  const portfolio = req.query.portfolioId;
  const symbol = req.query.symbol || BTC;
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
          _getLastTotal(portfolio.coins, symbol),
        ])
        .then(all => {
          portfolio.changePct = all[0];
          portfolio.amount = all[1];
          return portfolio;
        });
      }));
    })
    .then(portfolios => {
      return res.send({
        success: true,
        response: {
          portfolios,
        },
      });
    })
    .catch(err => {
      return res.send({
        success: false,
        response: {
          message: err,
        },
      });
    });
}

const _getLastTotal = (coins, symbol) => {
  let amount = 0;
  coins.forEach(coin => {
    amount += coin.symbol === BTC ? coin.amount : coin.amount * coin.market.prices.BTC.price;
  });
  if (symbol === BTC) return Promise.resolve(amount);
  return price(BTC, symbol).then(data => data.data[symbol] * amount);
};

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
             select: 'name symbol imageUrl prices.BTC.price prices.USD.price prices.RUB.price prices.BTC.changePctDay prices.USD.changePctDay prices.RUB.changePctDay prices.BTC.marketCap prices.BTC.totalVolume24HTo prices.BTC.supply prices.BTC.low24H  prices.BTC.high24H prices.USD.low24H  prices.USD.high24H',
           },
         ],
       },
    ])
    .then(portfolios => portfolios);
};

function updatePortfolios(req, res, next) {
  if (!req.body._id) {
    res.send({
      success: false,
      response: {
        message: '_id param is required',
      },
    });
    return next();
  }

  const query = {
    _id: req.body._id,
    owner: req.user._id,
  };

  PortfolioModel
    .findOne(query)
    .then(portfolio => {
      if (!portfolio) {
        res.send({
          success: false,
          response: {
            message: 'portfolio not found',
          },
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
              portfolio: updatedPortfolio,
            },
          });
        });
    })
    .catch(err => {
      res.send({
        success: false,
        response: {
          message: err,
        },
      });
    });
}

function delPortfolios(req, res, next) {
  if (!req.body.portfolioId) {
    res.send({
      success: false,
      response: {
        message: 'portfolioId param is required',
      },
    });
    return next();
  }

  const query = {
    _id: req.body.portfolioId,
    owner: req.user._id,
  };

  PortfolioModel
    .findOne(query)
    .then(portfolio => {
      if (!portfolio) {
        res.send({
          success: false,
          response: {
            message: 'portfolio not found',
          },
        });
        return next();
      }

      portfolio.isActive = false;

      return portfolio.save()
        .then(() => {
          return res.send({
            success: true,
            response: {
              portfolioId: portfolio._id,
            },
          });
        })
    })
    .catch(err => {
      res.send({
        success: false,
        response: {
          message: err,
        },
      });
    });
}

module.exports = {
  postPortfolios,
  getPortfolios,
  updatePortfolios,
  delPortfolios,
};
