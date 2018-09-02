const { getTotals, getLastTotal, getTotalsPct } = require('../../lib/services/totals');

function apiTotals(req, res, next) {
  const { portfolioId, range, symbol } = req.query;
  const { _id } = req.user;

  getTotals(_id, portfolioId, range, symbol)
    .then(totals => {
      console.log('totals', _id, portfolioId, range, symbol);
      res.send({
        success: true,
        response: {
          symbol,
          portfolioId,
          totals,
        }
      });
    });

}

module.exports = apiTotals;
