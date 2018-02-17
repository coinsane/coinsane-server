const config = require('../config');
const admin = require('firebase-admin');
const mongoose = require('mongoose');

admin.initializeApp(config.firebase);
const db = admin.database();

mongoose.Promise = Promise;
mongoose.connect(config.mongo.uri);
const marketModel = require('./models/market');
const coinModel = require('./models/coin');
const totalModel = require('./models/total');


function firebase() {
  return {
    db,
    coinsRef: db.ref('coins'),
    marketRef: db.ref('market'),
    portfoliosRef: db.ref('portfolios'),
    usersRef: db.ref('users'),
  };
}

function mongo() {
  return {
    marketModel,
    coinModel,
    totalModel
  };
}

module.exports = { firebase, mongo };
