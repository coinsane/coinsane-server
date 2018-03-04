const config = require('../../config');
const { mongo } = require('../../lib/db');

const rp = require('request-promise-native');
const Bottleneck = require('bottleneck');
const limiter = new Bottleneck(config.cryptocompare.limiter.histo);
const fetchLimit = limiter.wrap(rp);

const redis = require('redis');
const apiCache = redis.createClient(config.redis);
const { promisify } = require('util');
const apiCacheGet = promisify(apiCache.get).bind(apiCache);

const { MarketModel, CurrencyModel } = mongo();

function getMarket(req, res, next) {
  const limit = req.query.limit ? parseInt(req.query.limit) : null;
  const skip = req.query.skip ? parseInt(req.query.skip) : null;

  const cacheKey = `${config.env}:market:${JSON.stringify(req.query)}`;
  return apiCacheGet(cacheKey)
    .then(cached => {
      if (cached) {
        return JSON.parse(cached);
      }

      const query = {};

      return Promise.all([
        MarketModel.find(query, 'order name symbol imageUrl prices.BTC.price prices.BTC.marketCap prices.BTC.totalVolume24HTo prices.BTC.changePct24H prices.BTC.supply prices.USD.price prices.USD.marketCap prices.USD.totalVolume24HTo prices.USD.changePct24H prices.USD.supply prices.RUB.price prices.RUB.marketCap prices.RUB.totalVolume24HTo prices.RUB.changePct24H prices.RUB.supply')
          .skip(skip).limit(limit).sort('order'),
        MarketModel.count(query),
      ]).then(all => {
        const result = all[0];
        const count = all[1];
        const response = { result, count };
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

module.exports = {
  getMarket,
  getMarketCap,
};
