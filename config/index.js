process.env.NODE_ENV === 'dev' && require('dotenv').config();

const admin = require('firebase-admin');
const serviceAccount = require('./coinsane-org-firebase-adminsdk-ujxdk-56b3654d4d.json');

const config = {
  appName: 'Coinsane',
  cryptocompare: {
    apiUri: process.env.CRYPTOCOMPARE_API,
    apiMinUri: process.env.CRYPTOCOMPARE_API_MIN,
    limiter: {
      prices: {
        maxConcurrent: 8,
        minTime: 200
      },
      histo: {
        maxConcurrent: 1,
        minTime: 1000
      }
    }
  },
  port: process.env.PORT,
  authSecret: process.env.AUTH_SECRET,
  mongo: {
    uri: process.env.MONGODB_URI,
    options: {
      keepAlive: 300000,
      connectTimeoutMS: 30000
    }
  },
  redis: {
    url: process.env.REDISCLOUD_URL
  },
  firebase: {
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_CERT)),
    databaseURL: process.env.FIREBASE_URI,
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
