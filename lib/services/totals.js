const config = require('../../config');
const { mongo } = require('../db');
const rp = require('request-promise-native');

const { TotalModel } = mongo();

const redis = require('redis');
const apiCache = redis.createClient(config.redis);
const { promisify } = require('util');
const apiCacheGet = promisify(apiCache.get).bind(apiCache);

const {
  MINUTES_DAY,
  MINUTES_HOUR,
  HOURS_DAY,
  HOURS_WEEK,
  HOURS_MONTH,
  DAYS_MONTH,
  DAYS_YEAR
} = config.constants;

const getTotals = (owner, portfolio, range) => {
  const cacheKey = `${config.env}:service:getTotals:${JSON.stringify({ owner, portfolio, range })}`;
  return apiCacheGet(cacheKey)
    .then(cached => {
      if (cached) return JSON.parse(cached);
      return _getTotals(owner, portfolio, range)
        .then(totals => {
          allTotals = {};
          totals.forEach(total => {
            if (Array.isArray(total)) { // all portfolios
              total.forEach(tick => _allTotalsUpdate(allTotals, tick));
            } else {
              _allTotalsUpdate(allTotals, total);
            }
          });
          apiCache.set(cacheKey, JSON.stringify(allTotals), 'EX', config.cacheTime.totals);
          return allTotals;
        });
    });
}

const getTotalsPct = (owner, portfolio, range) => {
  return getTotals(owner, portfolio, range)
    .then(totals => {
      const totalsKeys = Object.keys(totals);
      if (!totalsKeys.length) return 0;
      const isNumber = typeof totals[totalsKeys[0]] === 'number';
      const firstKey = isNumber ? totals[totalsKeys[0]] : totals[totalsKeys[0]].avg;
      const lastKey = isNumber ? totals[totalsKeys[totalsKeys.length-1]] : totals[totalsKeys[totalsKeys.length-1]].avg;
      const changePct = parseFloat(1 - firstKey / lastKey).toFixed(2);
      return changePct;
    });
};

const getLastTotal = (owner, portfolio) => {
  return getTotals(owner, portfolio)
    .then(totals => {
      let total = 0;
      const totalsKeys = Object.keys(totals);
      if (totalsKeys.length) {
        total = totals[totalsKeys[0]];
      }
      return total;
    })
};

const _allTotalsUpdate = (allTotals, tick) => {
  if (!allTotals[tick.time]) {
    allTotals[tick.time] = tick.value;
  } else if (typeof tick.value === 'number') {
    allTotals[tick.time] += tick.value;
  } else {
    Object.keys(tick.value).forEach(key => {
      allTotals[tick.time][key] += tick.value[key];
    });
  }
}

const _getTotals = (owner, portfolio = 'all', range = '1d') => {
  const query = { owner };
  if (portfolio !== 'all') {
    query.portfolio = portfolio;
    return TotalModel.findOne(query).then(total => _parseTotals(total, range));
  }
  return TotalModel.find(query).then(totals => totals.map(total => _parseTotals(total, range)));
};

const _parseTotals = (totals, range) => {
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
      data = _aggregate(totals.mins, MINUTES_DAY, 10);
      break;
    case '1w':
      if (!totals.hours) {
        return data = _aggregate(totals.mins, MINUTES_DAY, 10);
      }
      data = totals.hours.slice(0, HOURS_WEEK);
      break;
    case '1m':
      if (!totals.hours) {
        return data = _aggregate(totals.mins, MINUTES_DAY, 10);
      }
      data = _aggregate(totals.hours, HOURS_MONTH, 6);
      break;
    case '3m':
      if (!totals.days) {
        if (!totals.hours) {
          return data = _aggregate(totals.mins, MINUTES_DAY, 10);
        }
        data = _aggregate(totals.hours, HOURS_MONTH, 6);
      }
      data = totals.days.slice(0, DAYS_MONTH * 3);
      break;
    case '6m':
      if (!totals.days) {
        if (!totals.hours) {
          return data = _aggregate(totals.mins, MINUTES_DAY, 10);
        }
        data = _aggregate(totals.hours, HOURS_MONTH, 6);
      }
      data = totals.days.slice(0, DAYS_MONTH * 6);
      break;
    case '1y':
      if (!totals.days) {
        if (!totals.hours) {
          return data = _aggregate(totals.mins, MINUTES_DAY, 10);
        }
        data = _aggregate(totals.hours, HOURS_MONTH, 6);
      }
      data = totals.days.slice(0, DAYS_YEAR);
      break;
    default: // longest
      if (!totals.days) {
        if (!totals.hours) {
          return data = _aggregate(totals.mins, MINUTES_DAY, 10);
        }
        data = _aggregate(totals.hours, HOURS_MONTH, 6);
      }
      data = totals.days;
      break;
  }

  return data;
}

function _aggregate(data, period, aggr) {
  const aggregated = [];
  data.forEach((item, index) => {
    if (index % aggr === 0) aggregated.push(item);
  });
  return aggregated.slice(0, period / aggr);
}

module.exports = {
  getTotals,
  getTotalsPct,
  getLastTotal,
};
