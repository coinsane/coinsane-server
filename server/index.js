const config = require('../config');
const restify = require('restify');

const { checkAuth, getToken, getUser } = require('./api/auth');
const apiHisto = require('./api/histo');
const apiLimits = require('./api/limits');
const apiTotals = require('./api/totals');

function startServer() {
  const server = restify.createServer();

  server.get('/auth/getToken', getToken);
  server.use(checkAuth);

  server.use(restify.plugins.queryParser());

  server.get('/auth/getUser', getUser);
  server.get('/histo', apiHisto);
  server.get('/limits', apiLimits);
  server.get('/totals', apiTotals);
  // server.post('/portfolioUpdate', apiPortfolioUpdate);

  server.listen(config.port, () => {
    console.log('%s listening at %s', server.name, server.url);
  });
}

module.exports = {
  startServer
};
