const mongooseConnect = require('../mongooseConnect');
mongooseConnect(startWorkers);

const updateTotals = require('./updateTotals');
const fetchPrices = require('./fetchPrices');

function startWorkers() {
  setTimeout(() => {
    updateTotals();
    setInterval(() => updateTotals(), 60 * 1000);
  }, 0);
  setTimeout(() => {
    fetchPrices();
    setInterval(() => fetchPrices(), 60 * 1000)
  }, 30 * 1000);
}
