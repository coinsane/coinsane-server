const config = require('../../config');
const { mongo } = require('../../lib/db');

const redis = require('redis');
const apiCache = redis.createClient(config.redis);
const { promisify } = require('util');
const apiCacheGet = promisify(apiCache.get).bind(apiCache);

const { MarketModel, CurrencyModel } = mongo();

function search(req, res, next) {
  const limit = req.query.limit ? parseInt(req.query.limit) : config.search.limit;
  const skip = req.query.skip ? parseInt(req.query.skip) : null;

  const cacheKey = `${config.env}:search:${JSON.stringify(req.query)}`;
  return apiCacheGet(cacheKey)
    .then(cached => {
      if (cached) {
        return JSON.parse(cached);
      }

      const q = req.query.q ? new RegExp(req.query.q, 'i') : null;
      const promiseQuery = [];
      let query;

      if (!req.query.type || req.query.type === 'market') {
        query = q ? {
          $or: [
            { symbol: q },
            { name: q },
          ]
        } : {};
        promiseQuery.push(MarketModel.find(query, 'order name symbol imageUrl prices.BTC.price prices.BTC.marketCap prices.BTC.totalVolume24HTo prices.BTC.changePct24H prices.BTC.supply prices.USD.price prices.USD.marketCap prices.USD.totalVolume24HTo prices.USD.changePct24H prices.USD.supply prices.RUB.price prices.RUB.marketCap prices.RUB.totalVolume24HTo prices.RUB.changePct24H prices.RUB.supply').skip(skip).limit(limit).sort('order'));
        promiseQuery.push(MarketModel.count(query))
      }

      if (!req.query.type || req.query.type === 'currency') {
        query = q ? {
          $or: [
            { symbol: q },
            { code: q },
            { name: q },
            { symbolNative: q },
          ]
        } : {};
        promiseQuery.push(CurrencyModel.find(query, 'symbol code name').skip(skip).limit(limit));
        promiseQuery.push(CurrencyModel.count(query))
      }

      return Promise.all(promiseQuery)
        .then(all => {
          let result;
          let count;
          if (all.length === 4) {
            result = [...all[0], ...all[2]];
            count = all[1] + all[3];
          } else {
            result = all[0];
            count = all[1];
          }
          const response = { result, count };
          apiCache.set(cacheKey, JSON.stringify(response), 'EX', config.cacheTime.search);
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

module.exports = {
  search,
};
