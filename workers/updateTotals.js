const config = require('../config');
const { db } = require('../lib/db');

const { CoinModel, TotalModel } = db();

module.exports = updatePortfoliosTotals;

function updatePortfoliosTotals() {
  const startTime = new Date();
  return Promise.resolve()
    .then(getAllPortfoliosTotals)
    .then(portfoliosLastTotals => {
      const portfolioIds = Object.keys(portfoliosLastTotals);
      const updatePromises = portfolioIds.map(portfolio => {
        const amount = portfoliosLastTotals[portfolio].amount;
        const owner = portfoliosLastTotals[portfolio].owner;
        return updatePortfolioTotals({ portfolio, amount, owner });
      });
      return Promise.all(updatePromises);
    })
    .then(() => {
      console.log('updateTotals', new Date(new Date() - startTime).getTime()/1000, 'sec' );
      return;
    });
}

function getAllPortfoliosTotals(coins) {
  return CoinModel.find({}, 'amount portfolio owner')
    .populate([
      {
        path: 'market',
        model: 'Market',
        select: 'symbol prices.BTC.price',
      }
    ])
    .then(coins => {
      if (!coins.length) return {};

      const portfolioTotals = {};
      coins.forEach(coin => {
        if (coin.market) {
          const amount = coin.market.symbol === 'BTC' ? coin.amount : coin.market.prices.BTC.price * coin.amount;
          if (!portfolioTotals[coin.portfolio]) {
            portfolioTotals[coin.portfolio] = {};
            portfolioTotals[coin.portfolio].amount = amount;
            portfolioTotals[coin.portfolio].owner = coin.owner;
          } else {
            portfolioTotals[coin.portfolio].amount += amount;
          }
        } else {
          console.log('getAllPortfoliosTotals ERROR', coin)
        }
      });
      return portfolioTotals;
    });
}


function updatePortfolioTotals(data) {
  const { portfolio, amount, owner } = data;
  const time = parseInt(Date.now() / 1000) * 1000;
  const totals = {};
  let mins = [];
  let hours = [];
  let days = [];

  const {
    MINUTES_DAY,
    MINUTES_HOUR,
    HOURS_DAY,
    HOURS_MONTH
  } = config.constants;

  return TotalModel.findOne({ portfolio })
    .then(portfolioTotals => {
      const total = {
        time,
        value: amount || 0
      };

      if (!portfolioTotals) {
        totals.mins = [total];
        totals.minsCount = 1;
        return totals;
      }

      if (portfolioTotals.mins.length > MINUTES_DAY - 1) {
        portfolioTotals.mins.splice(0, 1);
      }
      mins = portfolioTotals.mins.concat([], total);
      totals.minsCount = portfolioTotals.minsCount + 1;
      totals.mins = mins;

      if (portfolioTotals.hours.length) {
        hours = portfolioTotals.hours.concat([]);
        totals.hoursCount = portfolioTotals.hoursCount;
      }

      if (portfolioTotals.days.length) {
        days = portfolioTotals.days.concat([]);
        totals.daysCount = portfolioTotals.daysCount;
      }

      if (!totals.hoursCount) totals.hoursCount = 0;
      if (!totals.daysCount) totals.daysCount = 0;

      if (totals.minsCount > MINUTES_HOUR - 1) {
        let hoursCountFromMins = parseInt(totals.minsCount / MINUTES_HOUR);

        if (hoursCountFromMins && totals.minsCount % MINUTES_HOUR === 0) {
          if (hoursCountFromMins > HOURS_DAY) {
            hoursCountFromMins = HOURS_DAY;
          }
          const minsBlock = mins.slice((hoursCountFromMins-1) * MINUTES_HOUR, hoursCountFromMins * MINUTES_HOUR);

          const hour = {
            time,
            value: getMinMaxAvgHours(minsBlock)
          };
          hours.push(hour);
          totals.hours = hours;
          totals.hoursCount++;

          if (totals.hoursCount > HOURS_DAY - 1) {
            let daysCountFromHours = parseInt(totals.hoursCount / HOURS_DAY);

            if (totals.daysCount > daysCountFromHours) {
              daysCountFromHours = totals.daysCount;
            }

            if (daysCountFromHours && totals.hoursCount % HOURS_DAY === 0) {
              if (daysCountFromHours > HOURS_MONTH) {
                daysCountFromHours = HOURS_MONTH;
              }
              const daysBlock = hours.slice((daysCountFromHours-1) * HOURS_DAY, daysCountFromHours * HOURS_DAY);

              const day = {
                time,
                value: getMinMaxAvgDays(daysBlock)
              };
              days.push(day);
              totals.days = days;
              totals.daysCount++;
            }
          }

          if (hours.length > HOURS_MONTH) {
            hours.splice(0, 1);
          }

        }
      }

      return totals;
    })
    .then(totals => {
      return TotalModel.findOne({ portfolio })
        .then(total => {
          if (total) {
            Object.keys(totals).forEach(i => total[i] = totals[i]);
            total.owner = owner;
            return total.save().then();
          }
          const newTotal = new TotalModel(Object.assign(totals, { portfolio, owner }));
          return newTotal.save().then();
        }).catch(console.log);
    });
}

function getMinMaxAvgHours(arr) {
  let max = arr[0].value || 0;
  let min = arr[0].value || 0;
  let sum = arr[0].value || 0;
  for (let i = 1; i < arr.length; i++) {
    if (arr[i].value > max) max = arr[i].value;
    if (arr[i].value < min) min = arr[i].value;
    sum = sum + arr[i].value;
  }
  return { min, max, avg: sum / arr.length }
}

function getMinMaxAvgDays(arr) {
  try {
    let max = arr[0].value.avg || 0;
    let min = arr[0].value.avg || 0;
    let sum = arr[0].value.avg || 0;
    for (let i = 1; i < arr.length; i++) {
      if (arr[i].value.avg > max) max = arr[i].value.avg;
      if (arr[i].value.avg < min) min = arr[i].value.avg;
      sum = sum + arr[i].value.avg;
    }
    return { min, max, avg: sum / arr.length }
  } catch(e) {
    return { min: 0, max: 0, avg: 0 }
  }
}
