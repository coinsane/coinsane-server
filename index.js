const restify = require('restify');
const rp = require('request-promise-native');
const cache = require('memory-cache');
const Bottleneck = require('bottleneck');
const firebase = require('firebase');
const admin = require('firebase-admin');
const serviceAccount = require('./config/coinsane-org-firebase-adminsdk-ujxdk-56b3654d4d.json');

const config = {
  apiUri: 'https://min-api.cryptocompare.com/',
  limiter: {
    maxConcurrent: 1,
    minTime: 1000
  },
  port: process.env.PORT || 8080,
  firebase: {
    credential: admin.credential.cert(serviceAccount),
    databaseURL: 'https://coinsane-org.firebaseio.com',
    databaseAuthVariableOverride: {
      uid: 'coinsane-worker'
    }
  }
};

const limiter = new Bottleneck(config.limiter);
const fetchLimit = limiter.wrap(rp);
const apiCache = new cache.Cache();
const server = restify.createServer();

server.use(restify.plugins.queryParser());
server.get('/api/histo', apiHisto);
server.get('/api/limits', apiLimits);

server.listen(config.port, () => {
  console.log('%s listening at %s', server.name, server.url);
});




function apiHisto(req, res, next) {
  const { fsym, tsym, e = 'CCCAGG', range } = req.query;

  if (!(fsym && tsym && e && range)) {
    res.send({
      success: false,
      data: 'These query params are required: fsym, tsym, range'
    });
    return next();
  }

  const cacheKey = `histo:${JSON.stringify(req.query)}`;
  const cacheValue = apiCache.get(cacheKey);

  if (cacheValue) {
    console.log('from cache', cacheKey);
    res.send(JSON.parse(cacheValue));
    return next();
  }

  let aggregate;
  let limit;
  let period;

  switch (range) {
    case '1h':
      aggregate = 1;
      limit = 60;
      period = 'histominute';
      break;
    case '1d':
      aggregate = 10;
      limit = 144;
      period = 'histominute';
      break;
    case '1w':
      aggregate = 1;
      limit = 168;
      period = 'histohour';
      break;
    case '1m':
      aggregate = 6;
      limit = 120;
      period = 'histohour';
      break;
    case '3m':
      aggregate = 1;
      limit = 90;
      period = 'histoday';
      break;
    case '6m':
      aggregate = 1;
      limit = 180;
      period = 'histoday';
      break;
    case '1y':
      aggregate = 1;
      limit = 365;
      period = 'histoday';
      break;
  }

  let uri = `${config.apiUri}data/${period}`;
  let qs = {
    fsym,
    tsym,
    aggregate,
    limit,
    e,
  }

  fetchLimit({ uri, qs, json: true })
    .then(data => {
      const response = {
        success: data.Response === 'Success',
        data: data.Data
      };
      if (response.success) {
        console.log('from response', cacheKey);
        if (period == 'histoday') apiCache.put(cacheKey, JSON.stringify(data.Data), 12 * 60 * 60 * 1000); // once in 12h
        if (period == 'histohour') apiCache.put(cacheKey, JSON.stringify(data.Data), 30 * 60 * 1000); // once in 30m
        if (period == 'histominute') apiCache.put(cacheKey, JSON.stringify(data.Data), 30 * 1000); // once in 30s
      }
      res.send(response);
      next();
    });
}


function apiLimits(req, res, next) {
  const limitsPromises = ['second', 'hour'].map(period => {
    const uri = `${config.apiUri}stats/rate/${period}/limit`;
    return rp({ uri, json: true });
  });

  Promise
    .all(limitsPromises)
    .then(data => res.send(data));
}









admin.initializeApp(config.firebase);
const db = admin.database();

setInterval(() => updateTotals(), 30 * 1000);
setInterval(() => fetchPrices(), 30 * 1000);
setInterval(() => fetchCoins(), 24 * 60 * 60 * 1000);

function updateTotals() {
  const timestamp = parseInt(Date.now() / 1000) * 1000;
  const coinsRef = db.ref('coins');
  coinsRef.once('value', function(snapshot) {
    const coins = snapshot.val();
    if (coins && Object.keys(coins).length) {
      const coinPromises = [];
      Object.keys(coins).forEach(coinId => {
        coinPromises.push(new Promise((resolve, reject) => {
          const amount = coins[coinId].amount;
          const marketId = coins[coinId].marketId;
          const portfolioId = coins[coinId].portfolioId;

          const marketRef = db.ref(`market/${marketId}`);
          marketRef.once('value', function(snapshot) {
            const market = snapshot.val();
            if (market && market.prices && market.prices.BTC && market.prices.BTC.price) {
              const price = market.prices.BTC.price;
              const total = amount * price;
              resolve({ portfolioId, total });
            }
          });
        }));
      });
      Promise
        .all(coinPromises)
        .then(coinTotals => {
          if (coinTotals.length) {
            const portfolios = {};
            coinTotals.forEach(coin => {
              if (!portfolios[coin.portfolioId]) {
                portfolios[coin.portfolioId] = coin.total;
              } else {
                portfolios[coin.portfolioId] += coin.total;
              }
            });
            return portfolios;
          }
        })
        .then(portfolios => {
          const portfoliosRef = db.ref(`portfolios`);
          Object.keys(portfolios).forEach(portfolioId => {
            const totals = portfoliosRef.child(`${portfolioId}/totals`).push();
            totals.set({ timestamp, value: portfolios[portfolioId] });
          });
        });
    }
  });
}

function fetchPrices() {
  const marketRef = db.ref('market');
  marketRef.once('value', function(snapshot) {
    const market = snapshot.val();
    // const price
    if (market && Object.keys(market).length) {
      const symbols = Object.keys(market).map(key => market[key].symbol);
      const ids = Object.keys(market).map(key => market[key].id);

      const priceRequestPromises = [];

      const symbolsTo = ['BTC','USD','RUB'];

      let symbolsTemp = '';
      let idsTemp = '';

      symbols.forEach((symbol, index) => {
        if (!symbolsTemp) symbolsTemp = symbol;
        else symbolsTemp += `,${symbol}`;
        if (!idsTemp) idsTemp = ids[index];
        else idsTemp += `,${ids[index]}`;

        if (index === symbols.length - 1 || symbolsTemp.length > 290) {
          const reqSymbols = symbolsTemp.split(',');
          const reqIds = idsTemp.split(',');
          priceRequestPromises.push(rp({
            uri: `${config.apiUri}data/pricemultifull`,
            qs: {
              fsyms: symbolsTemp,
              tsyms: symbolsTo.join(',')
            },
            json: true
          }).then(priceData => {
            const data = {};
            reqSymbols.forEach((symbol, index) => {
              if (priceData.RAW[symbol]) {
                // data[`${reqIds[index]}`] = priceData.RAW[symbol]; // format this

                data[`${reqIds[index]}`] = {};

                const pricesRaw = priceData.RAW[symbol];

                // console.log('data', data)
                // console.log('pricesRaw', pricesRaw[symbolsTo[0]])

                symbolsTo.forEach(symbolTo => {
                  data[`${reqIds[index]}`][symbolTo] = {};
                  const price = pricesRaw[symbolTo];
                  // console.log('price', price);
                  if (price) {
                    if (price.PRICE) data[`${reqIds[index]}`][symbolTo].price = price.PRICE;
                    if (price.LASTUPDATE) data[`${reqIds[index]}`][symbolTo].lastUpdate = price.LASTUPDATE;
                    if (price.LASTVOLUME) data[`${reqIds[index]}`][symbolTo].lastVolume = price.LASTVOLUME;
                    if (price.LASTVOLUMETO) data[`${reqIds[index]}`][symbolTo].lastVolumeTo = price.LASTVOLUMETO;
                    if (price.VOLUMEDAY) data[`${reqIds[index]}`][symbolTo].volumeDay = price.VOLUMEDAY;
                    if (price.VOLUMEDAYTO) data[`${reqIds[index]}`][symbolTo].volumeDayTo = price.VOLUMEDAYTO;
                    if (price.VOLUME24HOUR) data[`${reqIds[index]}`][symbolTo].volume24H = price.VOLUME24HOUR;
                    if (price.VOLUME24HOURTO) data[`${reqIds[index]}`][symbolTo].volume24HTo = price.VOLUME24HOURTO;
                    if (price.OPENDAY) data[`${reqIds[index]}`][symbolTo].openDay = price.OPENDAY;
                    if (price.HIGHDAY) data[`${reqIds[index]}`][symbolTo].highDay = price.HIGHDAY;
                    if (price.LOWDAY) data[`${reqIds[index]}`][symbolTo].lowDay = price.LOWDAY;
                    if (price.OPEN24HOUR) data[`${reqIds[index]}`][symbolTo].open24H = price.OPEN24HOUR;
                    if (price.HIGH24HOUR) data[`${reqIds[index]}`][symbolTo].high24H = price.HIGH24HOUR;
                    if (price.LOW24HOUR) data[`${reqIds[index]}`][symbolTo].low24H = price.LOW24HOUR;
                    if (price.CHANGE24HOUR) data[`${reqIds[index]}`][symbolTo].change24H = price.CHANGE24HOUR;
                    if (price.CHANGEPCT24HOUR) data[`${reqIds[index]}`][symbolTo].changePct24H = price.CHANGEPCT24HOUR;
                    if (price.CHANGEDAY) data[`${reqIds[index]}`][symbolTo].changeDay = price.CHANGEDAY;
                    if (price.CHANGEPCTDAY) data[`${reqIds[index]}`][symbolTo].changePctDay = price.CHANGEPCTDAY;
                    if (price.SUPPLY) data[`${reqIds[index]}`][symbolTo].supply = price.SUPPLY;
                    if (price.MKTCAP) data[`${reqIds[index]}`][symbolTo].marketCap = price.MKTCAP;
                    if (price.TOTALVOLUME24H) data[`${reqIds[index]}`][symbolTo].totalVolume24H = price.TOTALVOLUME24H;
                    if (price.TOTALVOLUME24HTO) data[`${reqIds[index]}`][symbolTo].totalVolume24HTo = price.TOTALVOLUME24HTO;
                  }
                });
              }
            });
            return data;
          }));
          symbolsTemp = '';
          idsTemp = '';
        }
      });

      Promise.all(priceRequestPromises)
        .then(results => {
          let resultsAll = {};
          const prices = {};
          results.forEach((item, index) => {
            resultsAll = Object.assign(resultsAll, item);
          });
          return resultsAll;
        })
        .then(prices => {
          Object.keys(prices).forEach(id => {
            const child = marketRef.child(`${id}/prices`);
            child.set(prices[id], err => {
              if (err) console.log(err);
            });
          })
          console.log('fetchPrices done');
        });
    }
  });
}

function fetchCoins() {
  const uri = `${config.apiUri}data/coinlist`;
  rp({ uri, json: true })
    .then(data => {
      const items = Object.keys(data.Data).map(key => {
        const coinData = data.Data[key];
        return {
          id: coinData.Id ? `${coinData.Id}` : '',
          name: coinData.CoinName ? `${coinData.CoinName}` : '',
          symbol: coinData.Symbol ? `${coinData.Symbol}` : '',
          order: coinData.SortOrder ? parseInt(coinData.SortOrder) : 0,
          imageUrl: coinData.ImageUrl ? `${coinData.ImageUrl}` : '',
          // algorithm: coinData.Algorithm ? `${coinData.Algorithm}` : '',
          // proofType: coinData.ProofType ? `${coinData.ProofType}` : '',
          // totalCoinSupply: coinData.TotalCoinSupply ? `${coinData.TotalCoinSupply}` : '',
        };
      })

      items.forEach(item => {
        if (item.symbol.indexOf('*') === -1) {
          const child = marketRef.child(item.id);
          child.set(item, err => {
            if (err) console.log(err);
          });
        }
      });
      console.log('fetchCoins done');
    })
    .catch(console.log);
}
