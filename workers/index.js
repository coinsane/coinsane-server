const updateTotals = require('./updateTotals');
const fetchPrices = require('./fetchPrices');
const fetchCoins = require('./fetchCoins');

function startWorkers() {
  setTimeout(() => {
    updateTotals();
    setInterval(() => updateTotals(), 60 * 1000);
  }, 30 * 1000);
  setTimeout(() => {
    fetchPrices();
    setInterval(() => fetchPrices(), 60 * 1000)
  }, 60 * 1000);
  setTimeout(() => {
    fetchCoins();
    setInterval(() => fetchCoins(), 24 * 60 * 60 * 1000);
  }, 0);
}

module.exports = {
  startWorkers
};
