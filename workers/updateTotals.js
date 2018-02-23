const config = require('../config');
const { firebase, mongo } = require('../lib/db');
const rp = require('request-promise-native');

const { coinsRef, marketRef, portfoliosRef } = firebase();
const { marketModel, totalModel } = mongo();

module.exports = updatePortfoliosTotals;

function updatePortfoliosTotals() {
  const startTime = new Date();
  return Promise.resolve()
    .then(getAllCoins)
    .then(getAllCoinsTotals)
    .then(getAllPortfoliosTotals)
    .then(portfoliosLastTotals => {
      const portfolioIds = Object.keys(portfoliosLastTotals);
      const updatePromises = portfolioIds.map(portfolioId => {
        const lastTotal = portfoliosLastTotals[portfolioId].lastTotal;
        const owner = portfoliosLastTotals[portfolioId].owner;
        return updatePortfolioTotals({ portfolioId, lastTotal, owner });
      });
      return Promise.all(updatePromises);
    })
    .then(() => {
      console.log('updateTotals', new Date(new Date() - startTime).getTime()/1000, 'sec' );
      return;
    });
}

function getAllCoins() {
  return new Promise(resolve => {
    coinsRef.once('value', snapshot => resolve(snapshot.val()));
  });
}

function getAllCoinsTotals(coins) {
  return new Promise(resolve => {
    const coinsIds = Object.keys(coins);
    if (!coinsIds.length) return resolve({});
    const coinsMarketDataPromises = coinsIds.map(coinId => {
      const amount = coins[coinId].amount;
      const marketId = coins[coinId].marketId;
      const portfolioId = coins[coinId].portfolioId;
      const owner = Object.keys(coins[coinId].owner).map(userId => userId);
      return getCoinMarketData(marketId)
        .then(marketData => getPortfolioCoinTotal({ marketData, amount, coinId, portfolioId, owner }));
    });
    Promise
      .all(coinsMarketDataPromises)
      .then(resolve);
  });
}

function getCoinMarketData(id) {
  return new Promise(resolve => {
    marketModel.findOne({ id })
      .then(resolve);

    // const marketIdRef = marketRef.child(`${id}`);
    // marketIdRef.once('value', snapshot => resolve(snapshot.val()));
  });
}

function getPortfolioCoinTotal(data) {
  const { marketData, amount, coinId, portfolioId, owner } = data;
  return new Promise(resolve => {
    let price = 0;
    if (marketData && marketData.prices && marketData.prices.BTC && marketData.prices.BTC.price) {
      price = marketData.prices.BTC.price;
    }
    resolve({ coinId, portfolioId, owner, total: amount * price });
  });
}

function getAllPortfoliosTotals(coinTotals) {
  return new Promise(resolve => {
    if (!coinTotals.length) return resolve({});
    const portfolioTotals = {};
    coinTotals.forEach(coin => {
      if (!portfolioTotals[coin.portfolioId]) {
        portfolioTotals[coin.portfolioId] = {};
        portfolioTotals[coin.portfolioId].lastTotal = coin.total;
        portfolioTotals[coin.portfolioId].owner = coin.owner;
      } else {
        portfolioTotals[coin.portfolioId].lastTotal += coin.total;
      }
    });
    resolve(portfolioTotals);
  });
}


function updatePortfolioTotals(data) {
  const { portfolioId, lastTotal, owner } = data;
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

  return getPortfolioTotals(portfolioId)
    .then(portfolioTotals => {
      const total = {
        time,
        value: lastTotal || 0
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
      totalModel.findOne({ portfolioId })
        .then(total => {
          if (total) {
            Object.keys(totals).forEach(i => total[i] = totals[i]);
            total.owner = owner;
            return total.save()
          }
          const newTotal = new totalModel(Object.assign(totals, { portfolioId, owner }));
          newTotal.save();
        }).catch(console.log);

      const totalsObj = {};
      totals.mins.forEach(item => {
        if (!totalsObj.mins) totalsObj.mins = {};
        totalsObj.mins[item.time] = item.value || 0;
      });

      if (totals.hours && totals.hours.length) {
        totalsObj.hours = {};
        totals.hours.forEach(item => {
          totalsObj.hours[item.time] = {
            min: item.value['min'] || 0,
            max: item.value['max'] || 0,
            avg: item.value['avg'] || 0
          };
        });
      }

      if (totals.days && totals.days.length) {
        totalsObj.days = {};
        totals.days.forEach(item => {
          totalsObj.days[item.time] = {
            min: item.value['min'] || 0,
            max: item.value['max'] || 0,
            avg: item.value['avg'] || 0
          };
        });
      }

      const portfolioTotalsRef = portfoliosRef.child(`${portfolioId}/totals`);
      portfolioTotalsRef.set(totalsObj).catch(console.log);
      return;
    });
}


function getPortfolioTotals(portfolioId) {
  return new Promise(resolve => {
    totalModel.findOne({ portfolioId })
      .then(resolve);

    // const portfolioTotalsRef = portfoliosRef.child(`${portfolioId}/totals`);
    // portfolioTotalsRef.once('value', snapshot => resolve(snapshot.val()));
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
  let max = arr[0].value.avg || 0;
  let min = arr[0].value.avg || 0;
  let sum = arr[0].value.avg || 0;
  for (let i = 1; i < arr.length; i++) {
    if (arr[i].value.avg > max) max = arr[i].value.avg;
    if (arr[i].value.avg < min) min = arr[i].value.avg;
    sum = sum + arr[i].value.avg;
  }
  return { min, max, avg: sum / arr.length }
}


function totalObjToArray(obj) {
  if (!obj) return [];
  return Object.keys(obj).map(key => {
    return {
      time: key,
      value: obj[key] || 0
    }
  });
}

function totalArrayToObj(arr) {
  if (!arr || !arr.length) return {};
  const obj = {};
  arr.forEach(item => {
    obj[item.time] = item.value || 0;
  });
  return obj;
}
