const updateTotals = require('./updateTotals');
const fetchPrices = require('./fetchPrices');
const fetchCoins = require('./fetchCoins');

function startWorkers() {
  setInterval(() => updateTotals(), 60 * 1000); // every 1 min
  setTimeout(() => setInterval(() => fetchPrices(), 60 * 1000), 30 * 1000); // every 1 min, starts after 30 sec wait
  setInterval(() => fetchCoins(), 24 * 60 * 60 * 1000); // every day
}

module.exports = {
  startWorkers
};
