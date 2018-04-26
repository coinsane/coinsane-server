process.env.NODE_ENV === 'dev' && require('dotenv').config();

const config = {
  env: process.env.NODE_ENV,
  appName: 'Coinsane',
  cryptocompare: {
    apiUri: process.env.CRYPTOCOMPARE_API,
    apiMinUri: process.env.CRYPTOCOMPARE_API_MIN,
    limiter: {
      price: {
        maxConcurrent: 8,
        minTime: 200,
      },
      histo: {
        maxConcurrent: 1,
        minTime: 1000,
      }
    }
  },
  coinmarketcap: {
    apiUri: process.env.COINMARKETCAP_API,
  },
  cryptonator: {
    apiUri: process.env.CRYPTONATOR_API,
  },
  port: process.env.PORT,
  authSecret: process.env.AUTH_SECRET,
  mongo: {
    uri: process.env.MONGODB_URI,
    options: {
      keepAlive: 300000,
      connectTimeoutMS: 30000,
    }
  },
  redis: {
    url: process.env.REDISCLOUD_URL,
  },
  constants: {
    MINUTES_DAY: 1440,
    MINUTES_HOUR: 60,
    HOURS_DAY: 24,
    HOURS_WEEK: 168,
    HOURS_MONTH: 720,
    DAYS_MONTH: 30,
    DAYS_YEAR: 30,
  },
  search: {
    limit: parseInt(process.env.SEARCH_RESULTS_DEFAULT),
  },
  cacheTime: {
    search: process.env.CACHE_TIME_SEARCH,
    price: process.env.CACHE_TIME_PRICE,
    market: process.env.CACHE_TIME_MARKET,
    marketCap: process.env.CACHE_TIME_MARKET_CAP,
    totals: process.env.CACHE_TIME_TOTALS,
    coinDay: process.env.CACHE_TIME_COIN_DAY,
    coinHour: process.env.CACHE_TIME_COIN_HOUR,
    coinMinute: process.env.CACHE_TIME_COIN_MINUTE,
    topPairs: process.env.CACHE_TIME_TOP_PAIRS,
  },
};

module.exports = config;
