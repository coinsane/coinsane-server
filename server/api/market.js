const config = require('../../config');
const { db } = require('../../lib/db');
const { topPairs, pricefull } = require('../../lib/services/cryptocompare');

const rp = require('request-promise-native');
const Bottleneck = require('bottleneck');
const limiter = new Bottleneck(config.cryptocompare.limiter.histo);
const fetchLimit = limiter.wrap(rp);

const { getCacheKey, cacheGet, cacheSet } = require('../../lib/cache');
const { MarketModel, UserModel } = db();

function getMarket(req, res, next) {
  const limit = req.query.limit ? parseInt(req.query.limit) : null;
  const skip = req.query.skip ? parseInt(req.query.skip) : null;

  const cacheKey = getCacheKey('market', req.query);
  return cacheGet(cacheKey)
    .then(cached => {
      if (cached) {
        return JSON.parse(cached);
      }

      const query = {
        rank: { $exists: true },
      };

      return Promise.all([
        MarketModel.find(query, 'rank order name symbol imageUrl prices')
          .sort('rank')
          .skip(skip).limit(limit),
        MarketModel.count(query),
        _getUserCurrencies(req.user._id),
      ]).then(all => {
        const markets = all[0];
        const count = all[1];
        const currencies = all[2];
        return _getAmounts(markets, currencies).then(result => {
          const response = { result, count, skip, limit };
          cacheSet(cacheKey, response, config.cacheTime.market);
          return response;
        })
      })
    })
    .then(response => {
      return res.send({
        success: true,
        response
      });
    });
}

function getMarketCap(req, res, next) {
  const cacheKey = getCacheKey('market:cap', req.query);

  return new Promise((resolve, reject) => {
    cacheGet(cacheKey)
      .then(cacheValue => {
        if (cacheValue) {
          try {
            const response = JSON.parse(cacheValue);
            return resolve(response);
          } catch (e) {}
        }
        const uri = `${config.coinmarketcap.apiUri}/global/`;
        const qs = { convert: req.query.convert };
        return fetchLimit({ uri, qs, json: true })
          .then(res => {
            const symbol = req.query.convert ? req.query.convert : 'USD';
            const total = res.data.quotes ? res.data.quotes[symbol].total_market_cap : 0;
            const volume = res.data.quotes ? res.data.quotes[symbol].total_volume_24h : 0;
            return { total, volume };
          })
          .then(data => {
            const response = {
              success: true,
              data
            };
            if (response.success) {
              cacheSet(cacheKey, response, config.cacheTime.marketCap);
            }
            resolve(response);
          });
      })
  })
  .then(data => {
    res.send(data);
    next();
  });
}

function getMarketExchanges(req, res, next) {
  const { fsym, tsym, limit, nocache } = req.query;

  if (!(fsym)) {
    res.send({
      success: false,
      message: 'These query params are required: fsym',
    });
    return next();
  }

  return topPairs(fsym, tsym, { limit, nocache })
    .then(({ markets }) => {
      res.send({
        success: true,
        exchanges: markets,
      });
      next();
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

const _getAmounts = (markets, currencies) => {
  const prices = {};
  const currencySymbols = currencies.map(({ market, currency }) => {
    const currencySymbol = market ? market.symbol : currency.code;
    prices[currencySymbol] = 0;
    return currencySymbol;
  });

  const marketsPromises = [];
  markets.forEach(market => {
    marketsPromises.push(new Promise((resolve) => {
      const marketPricesPromises = [];
      currencySymbols.forEach(currencySymbol => {
        marketPricesPromises.push(pricefull(market.symbol, currencySymbol).then(data => {
          console.log('pricefulldata', { [currencySymbol]: data.data });
          return { [currencySymbol]: data.data };
        }));
      });
      Promise.all(marketPricesPromises)
        .then(marketPrices => {
          marketPrices.forEach(price => {
            const symbol = Object.keys(price)[0];
            market.prices[symbol] = price[symbol];
          });
          resolve(market);
        })
    }));
  });
  return Promise.all(marketsPromises)
};

module.exports = {
  getMarket,
  getMarketCap,
  getMarketExchanges,
};
