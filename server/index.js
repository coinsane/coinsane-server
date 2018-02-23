const config = require('../config');
const restify = require('restify');

const apiHisto = require('./api/histo');
const apiLimits = require('./api/limits');
const apiTotals = require('./api/totals');

function startServer() {
  const server = restify.createServer();

  server.use(parseAuth);
  server.use(restify.plugins.queryParser());
  server.get('/histo', apiHisto);
  server.get('/limits', apiLimits);
  server.get('/totals', apiTotals);
  // server.post('/portfolioUpdate', apiPortfolioUpdate);

  server.listen(config.port, () => {
    console.log('%s listening at %s', server.name, server.url);
  });
}

function parseAuth(req, res, next) {
  req.authorization = {};
  const authHeader = req.header('Authorization');
  if (!authHeader) return res.send('Authorization fail');

  const authParams = authHeader.split(' ');
  if (authParams[0] !== config.appName) {
    return res.send('Authorization fail');
  }
  authParams.forEach(param => {
    param = param.split('=');
    if (param[0] === 'token') {
      req.authorization.userId = param[1];
    }
  });
  return next();
}

module.exports = {
  startServer
};
