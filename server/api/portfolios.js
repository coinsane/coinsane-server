const { db } = require('../../lib/db');
const { getTotalsPct } = require('../../lib/services/totals');
const { getCoins } = require('../../lib/services/exchanges');
const { price, pricefull } = require('../../lib/services/cryptocompare');

const { PortfolioModel, ServiceModel, ProviderModel, UserModel } = db();

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
            isActive: true,
          };
          return ServiceModel.count(serviceQuery).then(count => {
            if (count) {
              return reject('Already connected');
            }
            return getCoins({ owner, portfolio, provider, key, secret })
              .then(coins => {
                if (coins) {
                  const service = new ServiceModel(serviceQuery);
                  service.portfolio = portfolio._id;
                  service.save();
                  portfolio.service = service._id;
                  portfolio.coins = coins;
                }
                return resolve(portfolio);
              })
              .catch(() => {
                reject('Can\'t connect to you account. Check your API key/secret');
              })
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
            response: { portfolio },
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

  const portfolioQuery = {
    owner,
    isActive: true
  };
  if (portfolio) {
    portfolioQuery._id = portfolio;
  }

  // TODO update response with a currency

  Promise
    .all([
      _getPortfolios(portfolioQuery),
      _getUserCurrencies(owner),
    ])
    .then(([portfolios, currencies]) => Promise.all(
      portfolios.map(portfolio => _updatePortfolioData(req, portfolio, currencies))
    ))
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

const _getUserCurrencies = (user_id) => {
  return UserModel.findById(user_id, 'settings')
    .populate([
      {
        path: 'settings.currencies.market',
        model: 'Market',
        select: '_id symbol imageUrl name',
      },
      {
        path: 'settings.currencies.currency',
        model: 'Currency',
        select: '_id code symbol decimalDigits',
      },
    ])
    .then(data => {
      return data.settings.currencies;
    });
};

const _updatePortfolioData = (req, portfolio, currencies) => {
  const owner = req.user._id;
  const symbol = req.query.symbol || BTC;
  const range = req.query.range || '1h';

  return Promise.all([
    getTotalsPct(owner, portfolio._id, range),
    _getAmountsAndCoins(portfolio.coins, symbol, currencies),
  ])
    .then(all => {
      portfolio.changePct = all[0];
      portfolio.amount = all[1].amount;
      portfolio.amounts = all[1].amounts;
      const coins = [];
      portfolio.coins.forEach(coin => {
        Object.keys(all[1].prices).forEach(coinId => {
          if (coin._id.toString() === coinId) {
            const { amount, from, to, ...prices } = all[1].prices[coinId];
            coin.market.prices = prices;
            coins.push(coin);
          }
        });
      });
      portfolio.coins = coins;

      return portfolio;
    });
};

const _getAmountsAndCoins = (coins, symbol, currencies) => {
  let amount = 0;
  const amounts = {};
  const prices = {};
  const currencySymbols = _getCurrencySymbols(currencies);
  currencySymbols.forEach(currencySymbol => {
    amounts[currencySymbol] = 0;
  });
  try {
    const coinsWithPricesPromises = [];

    coins.forEach(coin => {
      coinsWithPricesPromises.push(_getCoinPricesPromise(coin, currencySymbols));

      // old
      if (coin.market) {
        amount += coin.market.symbol === BTC ? coin.amount : coin.amount * coin.market.prices.BTC.price;
      }
    });

    return Promise.all(coinsWithPricesPromises)
      .then(coinsWithPrices => {
        coinsWithPrices.forEach(coinWithPrices => {
          const coinId = Object.keys(coinWithPrices)[0];
          coinWithPrices[coinId].forEach(item => {
            const coinSymbol = Object.keys(item)[0];
            if (item[coinSymbol]) {
              amounts[coinSymbol] += item[coinSymbol].amount;

              if (!prices[coinId]) prices[coinId] = {};
              prices[coinId][coinSymbol] = item[coinSymbol];
            }
          })
        });

        return Promise.resolve({ amount, amounts, prices });
      });
  } catch(e) {
    return Promise.resolve({ amount, amounts, prices });
  }
};

const _getCoinPricesPromise = (coin, currencySymbols) => {
  return new Promise(resolve => {
    const coinPricesPromises = [];
    currencySymbols.forEach(currencySymbol => {
      if (coin.market) {
        coinPricesPromises.push(getPrice(coin.amount, coin.market.symbol, currencySymbol));
      }
    });
    Promise.all(coinPricesPromises)
      .then(coinPrices => resolve({ [coin._id]: coinPrices }));
  })
};

const _getCurrencySymbols = (currencies) => {
  return currencies.map(({ market, currency }) => {
    return market ? market.symbol : currency.code;
  });
};

const getPrice = (amount, fromSym, toSym) => {
  // if (fromSym === toSym) {
  //   return Promise.resolve({[toSym]: amount})
  // } else {
    return pricefull(fromSym, toSym).then(data => {
      if (!data.data) {
        console.log('no data', data)
      }
      return {
        [toSym]: {
          ...data.data,
          amount: data.data.price * amount,
        },
      }
    });
    // return price(fromSym, toSym).then(data => {
    //   return { [toSym]: data.data[toSym] * amount };
    // });
  // }
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

      if (portfolio.service) {
        ServiceModel.findById(portfolio.service)
          .then(service => {
            service.isActive = false;
            service.save();
          });
      }

      return portfolio.save()
        .then(() => {
          return res.send({
            success: true,
            response: {
              portfolioId: portfolio._id,
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

module.exports = {
  postPortfolios,
  getPortfolios,
  updatePortfolios,
  delPortfolios,
};
