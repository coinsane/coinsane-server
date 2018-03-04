const config = require('../config');
const restify = require('restify');

const { checkAuth, getToken, getUser } = require('./api/auth');
const apiHisto = require('./api/histo');
const apiLimits = require('./api/limits');
const apiTotals = require('./api/totals');
const { postPortfolios, getPortfolios, updatePortfolios, delPortfolios } = require('./api/portfolios');
const { addCoin, getCoin, updateCoin, delCoin } = require('./api/coins');
const { getTransaction, updateTransaction, delTransaction } = require('./api/transactions');
const { search } = require('./api/search');
const { getMarket, getMarketCap } = require('./api/market');

function startServer() {
  const server = restify.createServer();

  server.get('/auth/getToken', getToken);
  server.use(checkAuth);

  server.use(restify.plugins.queryParser());
  server.use(restify.plugins.bodyParser());

  server.get('/auth/getUser', getUser);
  server.get('/histo', apiHisto);
  server.get('/limits', apiLimits);
  server.get('/totals', apiTotals);

  server.post('/portfolios', postPortfolios);
  server.get('/portfolios', getPortfolios);
  server.put('/portfolios', updatePortfolios);
  server.del('/portfolios', delPortfolios);

  server.post('/coins', addCoin);
  server.get('/coins', getCoin);
  server.put('/coins', updateCoin);
  server.del('/coins', delCoin);

  server.get('/transactions', getTransaction);
  server.put('/transactions', updateTransaction);
  server.del('/transactions', delTransaction);

  server.get('/search', search);

  server.get('/market', getMarket);
  server.get('/market/cap', getMarketCap);

  server.get('/currencies', (req, res, next) => {
    require('../lib/populate/currencies')();
    res.send();
    next();
  });

  server.listen(config.port, () => {
    console.log('%s listening at %s', server.name, server.url);
  });
}

module.exports = {
  startServer
};
