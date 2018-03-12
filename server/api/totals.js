const config = require('../../config');
const { mongo } = require('../../lib/db');
const { getTotals, getTotalsPct } = require('../../lib/services/totals');

function apiTotals(req, res, next) {
  const { portfolioId, range, symbol } = req.query;
  const { _id } = req.user;

  getTotals(_id, portfolioId, range, symbol)
    .then(totals => {
      const totalsKeys = Object.keys(totals);
      const lastTotal = totals[totalsKeys[0]];
      return getTotalsPct(_id, portfolioId, range, symbol)
        .then(changePct => {

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
    });

}

module.exports = apiTotals;
