const config = require('../config');
const restify = require('restify');

const { checkAuth, getToken, getUser } = require('./api/auth');
const { apiHisto, apiHistoPrice } = require('./api/histo');
const apiLimits = require('./api/limits');
const apiTotals = require('./api/totals');
const { postPortfolios, getPortfolios, updatePortfolios, delPortfolios } = require('./api/portfolios');
const { addCoin, getCoin, updateCoin, delCoin } = require('./api/coins');
const { getTransactionsList, getTransaction, updateTransaction, delTransaction } = require('./api/transactions');
const { search } = require('./api/search');
const { getMarket, getMarketCap, getMarketList } = require('./api/market');
const { getPrice, getPriceFull } = require('./api/price');
const { getCategories, updateCategory, delCategory } = require('./api/categories');

function startServer() {
  const server = restify.createServer();

  server.get('/auth/getToken', getToken);
  server.use(checkAuth);

  server.use(restify.plugins.queryParser());
  server.use(restify.plugins.bodyParser());

  server.use((req,res,next) => {
    if (req.query) console.log('req.query', req.query)
    if (req.body) console.log('req.body', req.body)
    next();
  });

  server.get('/auth/getUser', getUser);
  server.get('/histo', apiHisto);
  server.get('/histoprice', apiHistoPrice);
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

  server.get('/transactions', getTransactionsList);
  server.get('/transaction', getTransaction);
  server.put('/transaction', updateTransaction);
  server.del('/transaction', delTransaction);

  server.get('/search', search);

  server.get('/market', getMarket);
  server.get('/market/cap', getMarketCap);
  server.get('/market/list', getMarketList);

  server.get('/price', getPrice);
  server.get('/price/full', getPriceFull);

  server.get('/categories', getCategories);
  server.put('/categories', updateCategory);
  server.del('/categories', delCategory);

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
