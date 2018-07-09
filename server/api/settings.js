const config = require('../../config');
const { getCacheKey, cacheGet, cacheSet } = require('../../lib/cache');
const { db } = require('../../lib/db');
const { UserModel, MarketModel, CurrencyModel } = db();


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
          if (!data.settings) return _getDefaultCurrencies();
          return data.settings.currencies;
        })
        .then(data => {
          const currencies = _getCurrenciesObject(data);
          cacheSet(cacheKey, { currencies }, config.cacheTime.settings);
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

function _getCurrenciesObject(currencies) {
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

function _getDefaultCurrencies() {
  return Promise
    .all([
      MarketModel.findOne({ symbol: 'BTC' }, '_id symbol imageUrl name'),
      CurrencyModel.findOne({ code: 'USD' }, '_id code symbol decimalDigits'),
    ])
    .then(res => {
      return res.map((item, index) => {
        const currency = { system: true };
        if (index === 0) {
          currency.market = item;
        } else {
          currency.currency = item;
        }
        return currency;
      });
    });
}

module.exports = {
  getSettings,
};
