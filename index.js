const { startServer } = require('./server');
const { startWorkers } = require('./workers');

startServer();
startWorkers();
