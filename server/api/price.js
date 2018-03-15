const config = require('../../config');
const { mongo } = require('../../lib/db');

const rp = require('request-promise-native');
const Bottleneck = require('bottleneck');
const limiter = new Bottleneck(config.cryptocompare.limiter.price);
const fetchLimit = limiter.wrap(rp);

const redis = require('redis');
const apiCache = redis.createClient(config.redis);
const { promisify } = require('util');
const apiCacheGet = promisify(apiCache.get).bind(apiCache);

function getPrice(req, res, next) {
  const { fsym, tsyms } = req.query;

  if (!(fsym && tsyms)) {
    res.send({
      success: false,
      data: 'These query params are required: fsym, tsyms'
    });
    return next();
  }

  const cacheKey = `${config.env}:price:${JSON.stringify(req.query)}`;
  return apiCacheGet(cacheKey)
    .then(cacheValue => {
      if (cacheValue && !req.query.nocache) {
        try {
          const response = JSON.parse(cacheValue);
          response.cached = true;
          return res.send(response);
        } catch (e) {}
      }
      const uri = `${config.cryptocompare.apiMinUri}/data/price`;
      const qs = { fsym, tsyms };
      return fetchLimit({ uri, qs, json: true })
        .then(prices => {
          const response = {
            success: true,
            time: new Date(),
            cached: false,
            prices,
          };
          if (response.success) {
            apiCache.set(cacheKey, JSON.stringify(response), 'EX', config.cacheTime.price);
          }
          return res.send(response);
        })
        .catch(data => {
          return res.send({
            success: false,
            data: 'Api error'
          });
        });
    })
}

module.exports = {
  getPrice,
};
