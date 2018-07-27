const { db } = require('../../lib/db');
const { getTotalsPct } = require('../../lib/services/totals');
const { getCoins } = require('../../lib/services/exchanges');
const { price } = require('../../lib/services/cryptocompare');

const { PortfolioModel, ServiceModel, ProviderModel } = db();

const BTC = 'BTC';

function postPortfolios(req, res) {
  /*
  // populate providers
  ProviderModel.find({}).then(providers => {
    if (!providers.length) {
      const provider = new ProviderModel({ name: 'Bittrex' });
      provider.save(console.log);
    }
  });
  */

  const {
    title,
    inTotal,
    provider,
    key,
    secret,
  } = req.body;

  const body = {
    title,
    inTotal,
  };

  const owner = req.user;

  return new Promise((resolve, reject) => {
    const portfolio = new PortfolioModel({
      owner,
      ...body,
    });
    if (provider && key && secret) {
      ProviderModel.findOne({ _id: provider, isActive: true }).then(serviceProvider => {
        if (serviceProvider) {
          // add service
          const serviceQuery = {
            owner,
            key,
            secret,
            provider,
          };
          return ServiceModel.count(serviceQuery).then(count => {
            if (count) {
              reject('Already exists');
            }
            // TODO check is connectable? get coins
            return getCoins({ owner, portfolio, provider, key, secret })
              .then(coins => {
                console.log('coins', coins);
                if (coins) {
                  const service = new ServiceModel(serviceQuery);
                  console.log('service', service);
                  service.save();
                  portfolio.service = service._id;
                  portfolio.coins = coins;
                }
                console.log('portfolio', portfolio);
                return resolve(portfolio);
              })
              .catch(reject)
          });
        } else {
          reject('Wrong provider');
        }
      });
    } else {
      resolve(portfolio);
    }
  })
    .then(newPortfolio => {
      console.log('newPortfolio', newPortfolio);

      return newPortfolio.save()
        .then(portfolio => {
          return res.send({
            success: true,
            response: {
              portfolio: portfolio,
            },
          });
        });
    })
    .catch(message => {
      return res.send({
        success: false,
        response: { message },
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
         select: 'amount transactions',
         populate: [
           {
             path: 'market',
             model: 'Market',
             select: 'name symbol imageUrl prices',
           },
         ],
       },
      {
         path: 'service',
         model: 'Service',
         match: { isActive: true },
         select: 'provider',
         populate: [
           {
             path: 'provider',
             model: 'Provider',
             select: 'name description',
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
