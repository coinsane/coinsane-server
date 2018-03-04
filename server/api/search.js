const config = require('../../config');
const { mongo } = require('../../lib/db');

const redis = require('redis');
const apiCache = redis.createClient(config.redis);
const { promisify } = require('util');
const apiCacheGet = promisify(apiCache.get).bind(apiCache);

const { MarketModel, CurrencyModel } = mongo();

function search(req, res, next) {
  if (!req.query.type || !req.query.q || req.query.q.length < 2) {
    return res.send({
      success: false,
      response: {
        message: 'these properties are required: type, q'
      }
    });
  }

  const limit = req.query.limit ? parseInt(req.query.limit) : null;
  const skip = req.query.skip ? parseInt(req.query.skip) : null;

  const cacheKey = `${config.env}:search:${JSON.stringify(req.query)}`;
  return apiCacheGet(cacheKey)
    .then(cached => {
      if (cached) {
        return JSON.parse(cached);
      }

      const q = new RegExp(req.query.q, 'i');
      let queryModel;
      let query;

      switch (req.query.type) {
        case 'market':
          query = {
            $or: [
              { symbol: q },
              { name: q },
            ]
          };
          queryModel = Promise.all([
            MarketModel.find(query, 'order name symbol imageUrl').skip(skip).limit(limit).sort('order'),
            MarketModel.count(query),
          ])
          break;
        case 'currency':
          query = {
            $or: [
              { symbol: q },
              { code: q },
              { name: q },
              { symbolNative: q },
            ]
          };
          queryModel = Promise.all([
            CurrencyModel.find(query, 'symbol code name').skip(skip).limit(limit),
            CurrencyModel.count(query),
          ]);
          break;
        default:
          return res.send({
            success: false,
            response: {
              message: 'unsupported search type'
            }
          });
      }

      return queryModel.then(all => {
        const result = all[0];
        const count = all[1];
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
