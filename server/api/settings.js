const config = require('../../config');
const { getCacheKey, cacheGet, cacheSet } = require('../../lib/cache');
const { mongo } = require('../../lib/db');
const { UserModel } = mongo();


function getSettings(req, res) {
  const cacheKey = getCacheKey('settings', req.user._id);
  return cacheGet(cacheKey)
    .then(cached => {
      if (cached) return JSON.parse(cached);

      return UserModel.findById(req.user._id, 'settings')
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
          const currencies = getCurrenciesObject(data.settings.currencies);
          cacheSet(cacheKey, { currencies }, config.cacheTime.market);
          return { currencies };
        });
    })
    .then(data => {
      res.send({
        success: true,
        data
      })
    });
}

function getCurrenciesObject(currencies) {
  const list = {};
  currencies.forEach(item => {
    if (item.market) {
      return list[item.market.symbol] = {
        id: item.market._id,
        type: 'market',
        system: item.system,
        imageUrl: item.market.imageUrl,
        symbol: item.market.symbol,
        code: item.market.symbol,
        decimal: 8,
      }
    }
    if (item.currency) {
      return list[item.currency.code] = {
        id: item.currency._id,
        type: 'currency',
        system: item.system,
        imageUrl: '',
        symbol: item.currency.symbol,
        code: item.currency.code,
        decimal: item.currency.decimalDigits,
      }
    }
  });
  return list;
}

module.exports = {
  getSettings,
};
