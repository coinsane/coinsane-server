const config = require('../../config');
const { mongo } = require('../../lib/db');
const rp = require('request-promise-native');

const { totalModel } = mongo();

const {
  MINUTES_DAY,
  MINUTES_HOUR,
  HOURS_DAY,
  HOURS_WEEK,
  HOURS_MONTH
} = config.constants;

function apiTotals(req, res, next) {
  const { portfolioId, range } = req.query;

  if (!portfolioId) {
    res.send({
      success: false,
      data: 'These query params are required: portfolioId'
    });
    return next();
  }
  if (!range) {
    range = '1d';
  }

  totalModel.findOne({ portfolioId })
    .then(totals => {
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

      // cache it
    })
    .then(totals => {
      if (totals) {
        console.log(data.length)
        res.send({
          success: true,
          data: {
            portfolioId,
            totals
          }
        });
        return next();
      }
    });

}

function aggregate(data, period, aggr) {
  const aggregated = [];
  data.forEach((item, index) => {
    if (index % aggr === 0) aggregated.push(item);
  });
  console.log(aggregated)
  return aggregated.slice(0, period / aggr);
}

module.exports = apiTotals;
