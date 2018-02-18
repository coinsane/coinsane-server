const config = require('../config');
const { firebase, mongo } = require('../lib/db');
const rp = require('request-promise-native');

const { coinsRef, marketRef, portfoliosRef } = firebase();
const { marketModel, totalModel } = mongo();

module.exports = updatePortfoliosTotals;

function updatePortfoliosTotals() {
  return Promise.resolve()
    .then(getAllCoins)
    .then(getAllCoinsTotals)
    .then(getAllPortfoliosTotals)
    .then(portfoliosLastTotals => {
      const portfolioIds = Object.keys(portfoliosLastTotals);
      portfolioIds.forEach(portfolioId => {
        const lastTotal = portfoliosLastTotals[portfolioId];
        updatePortfolioTotals(portfolioId, lastTotal);
      });
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
      return getCoinMarketData(marketId)
        .then(marketData => getPortfolioCoinTotal(amount, coinId, portfolioId, marketData));
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

function getPortfolioCoinTotal(amount, coinId, portfolioId, marketData) {
  return new Promise(resolve => {
    let price = 0;
    if (marketData && marketData.prices && marketData.prices.BTC && marketData.prices.BTC.price) {
      price = marketData.prices.BTC.price;
    }
    resolve({ coinId, portfolioId, total: amount * price });
  });
}

function getAllPortfoliosTotals(coinTotals) {
  return new Promise(resolve => {
    if (!coinTotals.length) return resolve({});
    const portfolioTotals = {};
    coinTotals.forEach(coin => {
      if (!portfolioTotals[coin.portfolioId]) {
        portfolioTotals[coin.portfolioId] = coin.total;
      } else {
        portfolioTotals[coin.portfolioId] += coin.total;
      }
    });
    resolve(portfolioTotals);
  });
}


function updatePortfolioTotals(portfolioId, lastTotal) {
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
        value: lastTotal
      };

      if (!portfolioTotals) {
        totals.mins = [total];
        // totals.mins[time] = lastTotal;
        return totals;
      }

      // const minsArray = totalObjToArray(portfolioTotals.mins);
      // const hoursArray = totalObjToArray(portfolioTotals.hours);
      // const daysArray = totalObjToArray(portfolioTotals.days);
      const minsArray = portfolioTotals.mins;
      const hoursArray = portfolioTotals.hours;
      const daysArray = portfolioTotals.days;

      if (minsArray.length > MINUTES_DAY - 1) {
        minsArray.splice(0, 1);
      }

      if (hoursArray.length) {
        hours = hoursArray.concat([]);
      }

      if (daysArray.length) {
        days = daysArray.concat([]);
      }

      mins = minsArray.concat([], total);
      totals.mins = mins;
      // totals.mins = totalArrayToObj(mins);

      if (mins.length > MINUTES_HOUR - 1) {
        const minBlocks = parseInt(mins.length / MINUTES_HOUR);

        if (minBlocks && mins.length % MINUTES_HOUR === 0) {
          const minsBlock = mins.slice((minBlocks-1) * MINUTES_HOUR, minBlocks * MINUTES_HOUR);

          if (minsBlock.length === MINUTES_HOUR) {
            const hour = {
              time,
              value: getMinMaxAvgHours(minsBlock)
            };
            hours.push(hour);
            if (hours.length > HOURS_MONTH) {
              hours.splice(0, 1);
            }

            if (hours.length > HOURS_DAY - 1) {
              const hourBlocks = parseInt(hours.length / HOURS_DAY);

              if (hourBlocks && hours.length % HOURS_DAY === 0) {
                const hoursBlock = hours.slice((hourBlocks-1) * HOURS_DAY, hourBlocks * HOURS_DAY);
                if (hoursBlock.length === HOURS_DAY) {
                  const day = {
                    time,
                    value: getMinMaxAvgDays(hoursBlock)
                  };
                  days.push(day);
                }
              }
            }

          }
        }
        if (hours.length) totals.hours = hours;
        if (days.length) totals.days = days;
        // totals.hours = totalArrayToObj(hours);
        // totals.days = totalArrayToObj(days);
      }

      return totals;
    })
    .then(totals => {
      totalModel.findOne({ portfolioId })
        .then(total => {
          if (total) {
            Object.keys(totals).map(i => total[i] = totals[i]);
            return total.save()
          }
          // console.log('assign', Object.assign(totals, { portfolioId }))
          const newTotal = new totalModel(Object.assign(totals, { portfolioId }));
          newTotal.save();
        });

      //
      const totalsObj = {};
      totals.mins.forEach(item => {
        if (!totalsObj.mins) totalsObj.mins = {};
        totalsObj.mins[item.time] = item.value;
      });
      if (totals.hours) totals.hours.forEach(item => {
        if (!totalsObj.hours) totalsObj.hours = {};
        totalsObj.hours[item.time] = item.value;
      });
      if (totals.days) totals.days.forEach(item => {
        if (!totalsObj.days) totalsObj.days = {};
        totalsObj.days[item.time] = item.value;
      });

      const portfolioTotalsRef = portfoliosRef.child(`${portfolioId}/totals`);
      portfolioTotalsRef.set(totalsObj).catch(console.log);
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
  let max = arr[0].value;
  let min = arr[0].value;
  let sum = arr[0].value;
  for (let i = 1; i < arr.length; i++) {
    if (arr[i].value > max) max = arr[i].value;
    if (arr[i].value < min) min = arr[i].value;
    sum = sum + arr[i].value;
  }
  return { min, max, avg: sum / arr.length }
}

function getMinMaxAvgDays(arr) {
  let max = arr[0].value.avg;
  let min = arr[0].value.avg;
  let sum = arr[0].value.avg;
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
      value: obj[key]
    }
  });
}

function totalArrayToObj(arr) {
  if (!arr || !arr.length) return {};
  const obj = {};
  arr.forEach(item => {
    obj[item.time] = item.value;
  });
  return obj;
}
