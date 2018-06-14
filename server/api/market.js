const config = require('../../config');
const { db } = require('../../lib/db');
const { topPairs } = require('../../lib/services/cryptocompare');

const rp = require('request-promise-native');
const Bottleneck = require('bottleneck');
const limiter = new Bottleneck(config.cryptocompare.limiter.histo);
const fetchLimit = limiter.wrap(rp);

const redis = require('redis');
const apiCache = redis.createClient(config.redis);
const { promisify } = require('util');
const apiCacheGet = promisify(apiCache.get).bind(apiCache);

const { MarketModel } = db();

function getMarket(req, res, next) {
  const limit = req.query.limit ? parseInt(req.query.limit) : null;
  const skip = req.query.skip ? parseInt(req.query.skip) : null;

  const cacheKey = `${config.env}:market:${JSON.stringify(req.query)}`;
  return apiCacheGet(cacheKey)
    .then(cached => {
      if (cached) {
        return JSON.parse(cached);
      }

      const query = {
        'prices.BTC.totalVolume24HTo': { $gt: 10 },
        'prices.USD.lastVolume': { $gt: 0 },
      };

      return Promise.all([
        MarketModel.find(query, 'order name symbol imageUrl prices')
          .sort('-prices.BTC.marketCap')
          .skip(skip).limit(limit),
        MarketModel.count(query),
      ]).then(all => {
        const result = all[0];
        const count = all[1];
        const response = { result, count, skip, limit };
        apiCache.set(cacheKey, JSON.stringify(response), 'EX', config.cacheTime.market);
        return response;
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
  const cacheKey = `${config.env}:market:cap:${JSON.stringify(req.query)}`;

  return new Promise((resolve, reject) => {
    apiCacheGet(cacheKey)
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
          .then(data => {
            const symbol = req.query.convert ? req.query.convert.toLowerCase() : null;
            const total = symbol && data[`total_market_cap_${symbol}`] ? data[`total_market_cap_${symbol}`] : 0;
            const volume = symbol && data[`total_24h_volume_${symbol}`] ? data[`total_24h_volume_${symbol}`] : 0;
            return { total, volume };
          })
          .then(data => {
            const response = {
              success: true,
              data
            };
            if (response.success) {
              apiCache.set(cacheKey, JSON.stringify(response), 'EX', config.cacheTime.marketCap);
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

module.exports = {
  getMarket,
  getMarketCap,
  getMarketExchanges,
};
