const config = require('../../config');
const { db } = require('../db');
const rp = require('request-promise-native');
const Bottleneck = require('bottleneck');
const limiter = new Bottleneck(config.cryptocompare.limiter.histo);
const fetchLimit = limiter.wrap(rp);

const { getCacheKey, cacheGet, cacheSet } = require('../../lib/cache');
const { TotalModel, PortfolioModel } = db();

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
  const cacheKey = getCacheKey('service:getTotals', { owner, portfolio, range, symbol });
  return cacheGet(cacheKey)
    .then(cached => {
      if (cached) return JSON.parse(cached);
      return _getTotals(owner, portfolio, range)
        .then(totals => _convertToSymbol(totals, symbol, range))
        .then(totals => {
          const allTotals = {};
          totals.forEach(total => total.forEach(tick => _allTotalsUpdate(allTotals, tick)));
          cacheSet(cacheKey, allTotals, config.cacheTime.totals);
          return allTotals;
        });
    });
};

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
  return getTotals(owner, portfolio, '1h', symbol)
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
  };

  return fetchLimit({ uri, qs, json: true })
    .then(data => {
      const response = {
        success: data.Response === 'Success',
        data: data.Data
      };
      if (!response.success) return totals;
      const newTotals = [];
      // const date1 = new Date();
      totals.forEach(portfolioTotals => {
        const convertedTotals = [];
        portfolioTotals.forEach(total => {
          const time = parseInt(total.time.toString().slice(0, 10));
          const closestTime = _closestTime(response.data, time, total.value, period !== 'histominute');
          if (closestTime) {
            convertedTotals.push({
              _id: total._id,
              ...closestTime,
            });
          }
        });
        newTotals.push(convertedTotals);
      });
      // const date2 = new Date();
      // console.log(date2-date1, 'ms');
      return newTotals;
    });
};

function _closestTime(arr, time, value, avg) {
  if (!(arr) || arr.length === 0 || (avg && value.avg === 0)) return null;
  if (arr.length === 1) return avg && value.avg !== undefined
    ? {
      min: arr[0].low * value.min,
      max: arr[0].high * value.max,
      avg: arr[0].close * value.avg,
    }
    : arr[0].close * value;

  const closest = arr.sort((a, b) => Math.abs(time - a.time) - Math.abs(time - b.time))[0];

  return {
    time: closest.time,
    value: avg && value.avg !== undefined
      ? {
        min: closest.low * value.min,
        max: closest.high * value.max,
        avg: closest.close * value.avg,
      }
      : closest.close * value
  };
}

const _allTotalsUpdate = (allTotals, tick) => {
  if (!allTotals[tick.time]) {
    allTotals[tick.time] = tick.value;
  } else if (typeof tick.value === 'number') {
    allTotals[tick.time] += tick.value;
  } else {
    Object.keys(tick.value).forEach(key => {
      if (!allTotals[tick.time][key]) allTotals[tick.time][key] = tick.value[key];
      else allTotals[tick.time][key] += tick.value[key];
    });
  }
};

const _getTotals = (owner, portfolio = 'all', range = '1h') => {
  return Promise.resolve()
    .then(() => {
      const query = { owner };
      if (portfolio !== 'all') {
        query.portfolio = portfolio;
        return query;
      } else {
        return PortfolioModel.find({ ...query, isActive: true, inTotal: true }, '_id').then(portfolios => {
          return {
            ...query,
            $or: portfolios.map(portfolio => ({ portfolio: portfolio._id })),
          };
        });
      }
    })
    .then(query => TotalModel.find(query))
    .then(totals => totals.map(total => _parseTotals(total, range)));
};

const _parseTotals = (totals, range) => {
  let data, start, end;
  if (!totals) {
    data = [];
    return data;
  }

  switch (range) {
    case '1h':
      start = totals.mins.length - MINUTES_HOUR > 0 ? totals.mins.length - MINUTES_HOUR : 0;
      end = totals.mins.length;
      data = totals.mins.slice(start, end);
      break;
    case '1d':
      data = _aggregate(totals.mins, MINUTES_DAY, 10);
      break;
    case '1w':
      if (!totals.hours) {
        return data = _aggregate(totals.mins, MINUTES_DAY, 10);
      }
      start = totals.hours.length - HOURS_WEEK > 0 ? totals.hours.length - HOURS_WEEK : 0;
      end = totals.hours.length;
      data = totals.hours.slice(start, end);
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
      start = totals.days.length - (DAYS_MONTH * 3) > 0 ? totals.days.length - (DAYS_MONTH * 3) : 0;
      end = totals.days.length;
      data = totals.days.slice(start, end);
      break;
    case '6m':
      if (!totals.days) {
        if (!totals.hours) {
          return data = _aggregate(totals.mins, MINUTES_DAY, 10);
        }
        data = _aggregate(totals.hours, HOURS_MONTH, 6);
      }
      start = totals.days.length - (DAYS_MONTH * 6) > 0 ? totals.days.length - (DAYS_MONTH * 6) : 0;
      end = totals.days.length;
      data = totals.days.slice(start, end);
      break;
    case '1y':
      if (!totals.days) {
        if (!totals.hours) {
          return data = _aggregate(totals.mins, MINUTES_DAY, 10);
        }
        data = _aggregate(totals.hours, HOURS_MONTH, 6);
      }
      start = totals.days.length - DAYS_YEAR > 0 ? totals.days.length - DAYS_YEAR : 0;
      end = totals.days.length;
      data = totals.days.slice(start, end);
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
};

function _aggregate(data, period, aggr) {
  const aggregated = [];
  data.forEach((item, index) => {
    if (index % aggr === 0) aggregated.push(item);
  });
  const start = aggregated.length - period > 0 ? aggregated.length - period : 0;
  const end = aggregated.length;
  return aggregated.slice(start, end);
}

module.exports = {
  getTotals,
  getTotalsPct,
  getLastTotal,
};
