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

  const cacheKey = `search:${JSON.stringify(req.query)}`;
  return apiCacheGet(cacheKey)
    .then(cached => {
      if (cached) {
        return JSON.parse(cached);
      }

      const q = new RegExp(req.query.q, 'i');
      let queryModel;

      switch (req.query.type) {
        case 'market':
          queryModel = MarketModel.find({
            $or: [
              { symbol: q },
              { name: q },
            ]
          }, 'name symbol imageUrl');
          break;
        case 'currency':
          queryModel = CurrencyModel.find({
            $or: [
              { symbol: q },
              { code: q },
              { name: q },
              { symbolNative: q },
            ]
          }, 'symbol code name');
          break;
        default:
          return res.send({
            success: false,
            response: {
              message: 'unsupported search type'
            }
          });
      }

      return queryModel.then(result => {
        apiCache.set(cacheKey, JSON.stringify(result), 'EX', 12 * 60 * 60 * 1000);
        return result;
      })
    })
    .then(result => {
      return res.send({
        success: true,
        response: {
          result,
          count: result.length
        }
      });
    });

}

module.exports = {
  search,
};
