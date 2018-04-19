const config = require('../../config');
const { mongo } = require('../../lib/db');
const { getTotals, getLastTotal, getTotalsPct } = require('../../lib/services/totals');

function apiTotals(req, res, next) {
  const { portfolioId, range, symbol } = req.query;
  const { _id } = req.user;

    Promise
      .all([
        getLastTotal(_id, portfolioId, symbol),
        getTotals(_id, portfolioId, range, symbol),
        getTotalsPct(_id, portfolioId, range, symbol),
      ])
      .then(all => {
        const lastTotal = all[0];
        const totals = all[1];
        const changePct = all[2];
        res.send({
          success: true,
          response: {
            symbol,
            portfolioId,
            totals,
            changePct,
            lastTotal,
          }
        });
      });

}

module.exports = apiTotals;
