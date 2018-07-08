const config = require('../../config');
const { db } = require('../../lib/db');
const { getCacheKey, cacheGet, cacheSet } = require('../../lib/cache');

const { MarketModel, CurrencyModel } = db();

function search(req, res, next) {
  const limit = req.query.limit ? parseInt(req.query.limit) : config.search.limit;
  const skip = req.query.skip ? parseInt(req.query.skip) : null;

  const cacheKey = getCacheKey('search', req.query);
  return cacheGet(cacheKey)
    .then(cached => {
      if (cached) return JSON.parse(cached);

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
          let result;
          let count;
          if (all.length === 4) {
            result = [...all[0], ...all[2]];
            count = all[1] + all[3];
          } else {
            result = all[0];
            count = all[1];
          }
          const response = { result, count };
          cacheSet(cacheKey, response, config.cacheTime.search);
          return response;
        })
    })
    .then(response => {
      return res.send({
        success: true,
        response
      });
    });

}

module.exports = {
  search,
};
