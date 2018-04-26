const config = require('../../config');

const rp = require('request-promise-native');
const Bottleneck = require('bottleneck');
const limiter = new Bottleneck(config.cryptocompare.limiter.histo);
const fetchLimit = limiter.wrap(rp);

const redis = require('redis');
const apiCache = redis.createClient(config.redis);
const { promisify } = require('util');
const apiCacheGet = promisify(apiCache.get).bind(apiCache);

const { pricehisto } = require('../../lib/services/cryptocompare');

function apiHisto(req, res, next) {
  const { fsym, tsym, e = 'CCCAGG', range } = req.query;

  if (!(fsym && tsym && e && range)) {
    res.send({
      success: false,
      data: 'These query params are required: fsym, tsym, range',
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
  };

  const cacheKey = `${config.env}:histo:${JSON.stringify(req.query)}`;

  return new Promise((resolve, reject) => {
    apiCacheGet(cacheKey)
      .then(cacheValue => {
        if (cacheValue) {
          try {
            const response = JSON.parse(cacheValue);
            return resolve(response);
          } catch (e) {}
        }
        return fetchLimit({ uri, qs, json: true })
          .then(data => {
            const response = {
              success: data.Response === 'Success',
              data: {},
            };
            data.Data.forEach(item => {
              response.data[item.time] = (item.low + item.high) / 2;
            });
            if (response.success) {
              if (period === 'histoday') apiCache.set(cacheKey, JSON.stringify(response), 'EX', config.cacheTime.coinDay); // once in 12h
              if (period === 'histohour') apiCache.set(cacheKey, JSON.stringify(response), 'EX', config.cacheTime.coinHour); // once in 30m
              if (period === 'histominute') apiCache.set(cacheKey, JSON.stringify(response), 'EX', config.cacheTime.coinMinute); // once in 30s
            }
            resolve(response);
          });
      });
  })
  .then(formatHistoData)
  .then(data => {
    res.send(data);
    next();
  });

}

function apiHistoPrice(req, res, next) {
  const { fsym, tsyms, ts, markets = 'CCCAGG' } = req.query;

  if (!(fsym && tsyms && ts)) {
    res.send({
      success: false,
      data: 'These query params are required: fsym, tsyms, ts',
    });
    return next();
  }

  return pricehisto(fsym, tsyms, ts, { markets })
    .then(data => {
      res.send({
        success: true,
        data,
      });
      next();
    });
}

function formatHistoData(data) {
  return data;
}

module.exports = {
  apiHisto,
  apiHistoPrice,
};
