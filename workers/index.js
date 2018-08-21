const config = require('../config');

const mongooseConnect = require('../mongooseConnect');
mongooseConnect(startWorkers);

const updateTotals = require('./updateTotals');
const fetchPrices = require('./fetchPrices');
const fetchCoins = require('./fetchCoins');
const updateExchanges = require('./updateExchanges');

const cron = require('cron');

function startWorkers() {
  new cron.CronJob({
    cronTime: '0 */1 * * * *',
    onTick: () => updateExchanges(),
    start: true,
    timeZone: 'Europe/Moscow'
  });
  new cron.CronJob({
    cronTime: '0 */1 * * * *',
    onTick: () => {
      Promise.resolve()
        .then(fetchPrices)
        .then(updateTotals)
    },
    start: true,
    timeZone: 'Europe/Moscow'
  });
  new cron.CronJob({
    cronTime: '0 0 0 * * *',
    onTick: () => fetchCoins(),
    start: true,
    timeZone: 'Europe/Moscow'
  });
}
