const config = require('../../config');
const { db } = require('../../lib/db');
const { getCacheKey, cacheGet, cacheSet } = require('../../lib/cache');
const { pricefull } = require('../../lib/services/cryptocompare');

const { MarketModel, CurrencyModel, UserModel } = db();

function search(req, res, next) {
  const limit = req.query.limit ? parseInt(req.query.limit) : config.search.limit;
  const skip = req.query.skip ? parseInt(req.query.skip) : null;

  const cacheKey = getCacheKey('search', req.query);
  return cacheGet(cacheKey)
    .then(cached => {
      if (cached) return JSON.parse(cached);

      return _getUserCurrencies(req.user._id).then(currencies => {
        const q = req.query.q ? new RegExp(req.query.q, 'i') : null;
        const promiseQuery = [];
        let query;

        if (!req.query.type || req.query.type === 'market') {
          query = q ? {
            $or: [
              { symbol: q },
              { name: q },
            ],
            rank: { $exists: true },
          } : {
            rank: { $exists: true },
          };
          promiseQuery.push(MarketModel.find(query, 'rank order name symbol imageUrl prices').skip(skip).limit(limit).sort('rank'));
          promiseQuery.push(MarketModel.count(query))
        }

        if (!req.query.type || req.query.type === 'currency') {
          query = q ? {
            $or: [
              { symbol: q },
              { code: q },
              { name: q },
              { symbolNative: q },
            ]
          } : {};
          promiseQuery.push(CurrencyModel.find(query, 'symbol code name').skip(skip).limit(limit));
          promiseQuery.push(CurrencyModel.count(query))
        }

        return Promise.all(promiseQuery)
          .then(all => {
            let data;
            let count;
            if (all.length === 4) {
              data = [...all[0], ...all[2]];
              count = all[1] + all[3];
            } else {
              data = all[0];
              count = all[1];
            }
            return _getAmounts(data, currencies).then(result => {
              // console.log('result', result);
              const response = { result, count };
              cacheSet(cacheKey, response, config.cacheTime.search);
              return response;
            });
          })
      });
    })
    .then(response => {
      return res.send({
        success: true,
        response
      });
    });

}


const _getUserCurrencies = (user_id) => {
  return UserModel.findById(user_id, 'settings')
    .populate([
      {
        path: 'settings.currencies.market',
        model: 'Market',
        select: '_id symbol imageUrl name',
      },
      {
        path: 'settings.currencies.currency',
        model: 'Currency',
        select: '_id code symbol decimalDigits',
      },
    ])
    .then(data => {
      return data.settings.currencies;
    });
};

const _getAmounts = (markets, currencies) => {
  const prices = {};
  const currencySymbols = currencies.map(({ market, currency }) => {
    const currencySymbol = market ? market.symbol : currency.code;
    prices[currencySymbol] = 0;
    return currencySymbol;
  });

  const marketsPromises = [];
  markets.forEach(market => {
    marketsPromises.push(new Promise((resolve) => {
      const marketPricesPromises = [];
      currencySymbols.forEach(currencySymbol => {
        marketPricesPromises.push(pricefull(market.symbol, currencySymbol).then(data => {
          // console.log('pricefulldata', { [currencySymbol]: data.data });
          return { [currencySymbol]: data.data };
        }));
      });
      Promise.all(marketPricesPromises)
        .then(marketPrices => {
          // console.log('marketPrices', marketPrices)
          const prices = {};
          marketPrices.forEach(price => {
            const symbol = Object.keys(price)[0];
            prices[symbol] = price[symbol];
          });
          // console.log('prices', prices);
          market.prices = prices;
          resolve(market);
        })
    }));
  });
  return Promise.all(marketsPromises)
    .then(markets => {
      // console.log('markets', markets)
      return markets;
    })
};

module.exports = {
  search,
};
