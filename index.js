const config = require('./config');
const mongoose = require('mongoose');

const { startServer } = require('./server');
const { startWorkers } = require('./workers');

mongoose.connect(config.mongo.uri, config.mongo.options, (err, res) => {
  if (err) {
    console.log ('ERROR connecting to: ' + uristring + '. ' + err);
  } else {
    console.log ('Succeeded connected to: ' + uristring);
  }
});
mongoose.Promise = Promise;

const conn = mongoose.connection;

conn.on('error', console.error.bind(console, 'connection error:'));
conn.once('open', () => {
  startServer();
  startWorkers();
});
