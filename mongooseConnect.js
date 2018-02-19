module.exports = runScript => {
  const config = require('./config');
  const mongoose = require('mongoose');

  mongoose.connect(config.mongo.uri, config.mongo.options);
  mongoose.Promise = Promise;

  const conn = mongoose.connection;

  conn.on('error', console.error.bind(console, 'connection error:'));
  conn.once('open', runScript);
}
