const admin = require('firebase-admin');
const serviceAccount = require('./coinsane-org-firebase-adminsdk-ujxdk-56b3654d4d.json');

const config = {
  apiUri: 'https://min-api.cryptocompare.com/',
  apiUriOld: 'https://www.cryptocompare.com/api/',
  limiter: {
    maxConcurrent: 1,
    minTime: 1000
  },
  port: process.env.PORT || 8080,
  mongo: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/coinsane',
    options: {
      keepAlive: 300000,
      connectTimeoutMS: 30000
    }
  },
  firebase: {
    credential: admin.credential.cert(serviceAccount),
    databaseURL: 'https://coinsane-org.firebaseio.com',
    databaseAuthVariableOverride: {
      uid: 'coinsane-worker'
    }
  },
  constants: {
    MINUTES_DAY: 1440,
    MINUTES_HOUR: 60,
    HOURS_DAY: 24,
    HOURS_WEEK: 168,
    HOURS_MONTH: 720,
    DAYS_MONTH: 30,
    DAYS_YEAR: 30,
  }
};

module.exports = config;
