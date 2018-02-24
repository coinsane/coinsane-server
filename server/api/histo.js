const config = require('../../config');

const rp = require('request-promise-native');
const Bottleneck = require('bottleneck');
const limiter = new Bottleneck(config.cryptocompare.limiter.histo);
const fetchLimit = limiter.wrap(rp);

const redis = require('redis');
const apiCache = redis.createClient(config.redis);
const { promisify } = require('util');
const apiCacheGet = promisify(apiCache.get).bind(apiCache);

function apiHisto(req, res, next) {
  const { fsym, tsym, e = 'CCCAGG', range } = req.query;

  if (!(fsym && tsym && e && range)) {
    res.send({
      success: false,
      data: 'These query params are required: fsym, tsym, range'
    });
    return next();
  }

  let aggregate;
  let limit;
  let period;

  switch (range) {
    case '1h':
      aggregate = 1;
      limit = 60;
      period = 'histominute';
      break;
    case '1d':
      aggregate = 10;
      limit = 144;
      period = 'histominute';
      break;
    case '1w':
      aggregate = 1;
      limit = 168;
      period = 'histohour';
      break;
    case '1m':
      aggregate = 6;
      limit = 120;
      period = 'histohour';
      break;
    case '3m':
      aggregate = 1;
      limit = 90;
      period = 'histoday';
      break;
    case '6m':
      aggregate = 1;
      limit = 180;
      period = 'histoday';
      break;
    case '1y':
      aggregate = 1;
      limit = 365;
      period = 'histoday';
      break;
  }

  let uri = `${config.cryptocompare.apiMinUri}/data/${period}`;
  let qs = {
    fsym,
    tsym,
    aggregate,
    limit,
    e,
  }

  const cacheKey = `histo:${JSON.stringify(req.query)}`;

  return new Promise((resolve, reject) => {
    apiCacheGet(cacheKey)
      .then(cacheValue => {
        if (cacheValue) {
          try {
            console.log('from cache', cacheKey);
            const response = JSON.parse(cacheValue);
            return resolve(response);
          } catch (e) {}
        }
        return fetchLimit({ uri, qs, json: true })
          .then(data => {
            const response = {
              success: data.Response === 'Success',
              data: data.Data
            };
            if (response.success) {
              console.log('from response', cacheKey);
              if (period == 'histoday') apiCache.set(cacheKey, JSON.stringify(response), 'EX', 12 * 60 * 60 * 1000); // once in 12h
              if (period == 'histohour') apiCache.set(cacheKey, JSON.stringify(response), 'EX', 30 * 60 * 1000); // once in 30m
              if (period == 'histominute') apiCache.set(cacheKey, JSON.stringify(response), 'EX', 30 * 1000); // once in 30s
            }
            resolve(response);
          });
      })
  })
  .then(data => {
    res.send({
      success: true,
      data
    });
    next();
  });

}

module.exports = apiHisto;
