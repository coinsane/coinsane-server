const config = require('../../config');
const { mongo } = require('../../lib/db');
const rp = require('request-promise-native');

const { totalModel } = mongo();

const redis = require('redis');
const apiCache = redis.createClient(config.redis);
const { promisify } = require('util');
const apiCacheGet = promisify(apiCache.get).bind(apiCache);

const {
  MINUTES_DAY,
  MINUTES_HOUR,
  HOURS_DAY,
  HOURS_WEEK,
  HOURS_MONTH
} = config.constants;

function apiTotals(req, res, next) {
  const { portfolioId, range } = req.query;
  const { userId } = req.authorization;

  if (!portfolioId) {
    res.send({
      success: false,
      data: 'These query params are required: portfolioId'
    });
    return next();
  }

  const getTotals = () => {
    const query = { owner: userId };
    if (portfolioId === 'all') {
      return totalModel.find(query).then(totals => totals.map(parseTotals));
    }
    query.portfolioId = portfolioId;
    return totalModel.findOne(query).then(parseTotals);
  };

  const parseTotals = totals => {
    let data;
    if (!totals) {
      data = [];
      return data;
    }

    switch (range) {
      case '1h':
        data = totals.mins.slice(0, MINUTES_HOUR);
        break;
      case '1d':
        data = aggregate(totals.mins, MINUTES_DAY, 10);
        break;
      case '1w':
        if (!totals.hours) {
          return data = aggregate(totals.mins, MINUTES_DAY, 10);
        }
        data = totals.hours.slice(0, HOURS_WEEK);
        break;
      case '1m':
        if (!totals.hours) {
          return data = aggregate(totals.mins, MINUTES_DAY, 10);
        }
        data = aggregate(totals.hours, HOURS_MONTH, 6);
        break;
      case '3m':
        if (!totals.days) {
          if (!totals.hours) {
            return data = aggregate(totals.mins, MINUTES_DAY, 10);
          }
          data = aggregate(totals.hours, HOURS_MONTH, 6);
        }
        data = totals.days.slice(0, DAYS_MONTH * 3);
        break;
      case '6m':
        if (!totals.days) {
          if (!totals.hours) {
            return data = aggregate(totals.mins, MINUTES_DAY, 10);
          }
          data = aggregate(totals.hours, HOURS_MONTH, 6);
        }
        data = totals.days.slice(0, DAYS_MONTH * 6);
        break;
      case '1y':
        if (!totals.days) {
          if (!totals.hours) {
            return data = aggregate(totals.mins, MINUTES_DAY, 10);
          }
          data = aggregate(totals.hours, HOURS_MONTH, 6);
        }
        data = totals.days.slice(0, DAYS_YEAR);
        break;
      default: // longest
        if (!totals.days) {
          if (!totals.hours) {
            return data = aggregate(totals.mins, MINUTES_DAY, 10);
          }
          data = aggregate(totals.hours, HOURS_MONTH, 6);
        }
        data = totals.days;
        break;
    }

    return data;
  }

  const cacheKey = `totals:${JSON.stringify(Object.assign(req.query, { userId }))}`;
  return apiCacheGet(cacheKey)
    .then(cached => {
      if (cached) return JSON.parse(cached);
      return getTotals()
        .then(totals => {
          sumTotals = {};
          totals.forEach(total => {

            if (Array.isArray(total)) {
              total.forEach(tick => {
                if (!sumTotals[tick.time]) {
                  sumTotals[tick.time] = tick.value;
                } else if (typeof tick.value === 'number') {
                  sumTotals[tick.time] += tick.value;
                } else {
                  Object.keys(tick.value).forEach(key => {
                    sumTotals[tick.time][key] += tick.value[key];
                  });
                }
              });
            } else {
              if (!sumTotals[total.time]) {
                return sumTotals[total.time] = total.value;
              } else if (typeof total.value === 'number') {
                sumTotals[total.time] += total.value;
              } else {
                Object.keys(total.value).forEach(key => {
                  sumTotals[total.time][key] += tick.value[key];
                });
              }
            }
          });
          apiCache.set(cacheKey, JSON.stringify(sumTotals), 'EX', 30 * 1000);
          return sumTotals;
        });
    })
    .then(totals => {
      res.send({
        success: true,
        data: {
          portfolioId,
          totals
        }
      });
      return next();
    });

}

function aggregate(data, period, aggr) {
  const aggregated = [];
  data.forEach((item, index) => {
    if (index % aggr === 0) aggregated.push(item);
  });
  return aggregated.slice(0, period / aggr);
}

module.exports = apiTotals;
