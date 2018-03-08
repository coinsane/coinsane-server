const config = require('../../config');
const { mongo } = require('../../lib/db');
const { getTotals, getTotalsPct } = require('../../lib/services/totals');

function apiTotals(req, res, next) {
  const { portfolioId, range } = req.query;
  const { _id } = req.user;

  getTotals(_id, portfolioId, range)
    .then(totals => {
      return getTotalsPct(_id, portfolioId, range)
        .then(changePct => {
          res.send({
            success: true,
            response: {
              portfolioId,
              totals,
              changePct
            }
          });
        });
    });

}

module.exports = apiTotals;
