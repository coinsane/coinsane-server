const config = require('../../config');
const { db } = require('../db');
const rp = require('request-promise-native');
const Bottleneck = require('bottleneck');
const limiter = new Bottleneck(config.cryptocompare.limiter.histo);
const fetchLimit = limiter.wrap(rp);

const { TotalModel } = db();

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

const getTotals = (owner, portfolio, range, symbol) => {
  const cacheKey = `${config.env}:service:getTotals:${JSON.stringify({ owner, portfolio, range, symbol })}`;
  return apiCacheGet(cacheKey)
    .then(cached => {
      if (cached) return JSON.parse(cached);
      return _getTotals(owner, portfolio, range)
        .then(totals => _convertToSymbol(totals, symbol, range))
        .then(totals => {
          allTotals = {};
          totals.forEach(total => total.forEach(tick => _allTotalsUpdate(allTotals, tick)));
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
      const changePct = parseFloat(parseFloat(1 - firstKey / lastKey).toFixed(2));
      return changePct;
    });
};

const getLastTotal = (owner, portfolio, symbol) => {
  return getTotals(owner, portfolio, '1d', symbol)
    .then(totals => {
      let total = 0;
      const totalsKeys = Object.keys(totals);
      if (totalsKeys.length) {
        total = totals[totalsKeys[totalsKeys.length-1]];
      }
      return total;
    })
};

const _convertToSymbol = (totals, symbol, range) => {
  if (!symbol || !range) return totals;

  let period;
  let aggregate;
  let limit;

  switch (range) {
    case '1h':
      period = 'histominute';
      aggregate = 0;
      limit = MINUTES_HOUR;
      break;
    case '1d':
      period = 'histominute';
      aggregate = 10;
      limit = MINUTES_DAY;
      break;
    case '1w':
      period = 'histohour';
      aggregate = 0;
      limit = HOURS_WEEK;
      break;
    case '1m':
      period = 'histohour';
      aggregate = 6;
      limit = HOURS_MONTH;
      break;
    case '3m':
      period = 'histoday';
      aggregate = 0;
      limit = DAYS_MONTH * 3;
      break;
    case '6m':
      period = 'histoday';
      aggregate = 0;
      limit = DAYS_MONTH * 6;
      break;
    case '1y':
      period = 'histoday';
      aggregate = 0;
      limit = DAYS_YEAR;
      break;
    default: // longest
      period = 'histoday';
      aggregate = 0;
      limit = 99999;
      break;
  }

  let uri = `${config.cryptocompare.apiMinUri}/data/${period}`;
  let qs = {
    fsym: 'BTC',
    tsym: symbol,
    aggregate,
    limit,
    // e,
  }

  return fetchLimit({ uri, qs, json: true })
    .then(data => {
      const response = {
        success: data.Response === 'Success',
        data: data.Data
      };
      if (!response.success) return totals;
      const newTotals = [];
      const date1 = new Date();
      totals.forEach(portfolioTotals => {
        const convertedTotals = [];
        portfolioTotals.forEach(total => {
          const time = parseInt(total.time.toString().slice(0, 10));
          if (period === 'histominute') {
            convertedTotals.push({
              _id: total._id,
              time: total.time,
              value: _closestTime(response.data, time, total.value)
            });
          } else {
            convertedTotals.push({
              _id: total._id,
              time: total.time,
              value: _closestTime(response.data, time, total.value, true)
            });
          }
        });
        newTotals.push(convertedTotals);
      });
      const date2 = new Date();
      console.log(date2-date1, 'ms')
      // console.log('portfolioTotals1', JSON.stringify(response.data))
      return newTotals;
    });
}

function _closestTime(arr, time, value, avg) {
  if (!(arr) || arr.length == 0) return null;
  if (arr.length == 1) return avg ? {
    min: arr[0].low * value.min,
    max: arr[0].high * value.max,
    avg: arr[0].close * value.avg,
  } : arr[0].close * value;

  for (let i = 1; i < arr.length; i++) {
    if (arr[i].time > time) {
      const p = arr[i - 1];
      const c = arr[i];
      return Math.abs(p.time - time) < Math.abs(c.time - time) ? (avg ? {
        min: p.low * value.min,
        max: p.high * value.max,
        avg: p.close * value.avg,
      } : p.close * value) : (avg ? {
        min: c.low * value.min,
        max: c.high * value.max,
        avg: c.close * value.avg,
      } : c.close * value);
    }
  }
  return  avg ? {
    min: arr[arr.length - 1].low * value.min,
    max: arr[arr.length - 1].high * value.max,
    avg: arr[arr.length - 1].close * value.avg,
  } : arr[arr.length - 1].close * value;
}

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
