const config = require('../config');
const restify = require('restify');

const apiHisto = require('./api/histo');
const apiLimits = require('./api/limits');

function startServer() {
  const server = restify.createServer();

  server.use(restify.plugins.queryParser());
  server.get('/api/histo', apiHisto);
  server.get('/api/limits', apiLimits);
  // server.post('/api/portfolioUpdate', apiPortfolioUpdate);

  server.listen(config.port, () => {
    console.log('%s listening at %s', server.name, server.url);
  });
}

module.exports = {
  startServer
};
