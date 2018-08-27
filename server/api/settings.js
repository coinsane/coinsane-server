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

function addCurrency(req, res) {
  if (req.body.currencyId) {
    return Promise
      .all([
        CurrencyModel.findById(req.body.currencyId, '_id code symbol decimalDigits'),
        UserModel.findById(req.user._id, 'settings'),
      ])
      .then(res => {
        const [ currency, user ] = res;
        if (currency && user) {
          user.settings.currencies = [
            ...user.settings.currencies,
            { currency },
          ];
          user.save();
          res.send({
            success: true,
            // data
          });
        }
      });
  }
  res.send({
    success: false,
  });
}

function delCurrency(req, res) {
  if (req.body.currencyId) {
    return UserModel.findById(req.user._id, 'settings')
      .then(user => {
        const currencies = [];
        user.settings.currencies.forEach((item) => {
          if (item.currency.toString() !== req.body.currencyId) currencies.push(item);
        });
        user.settings.currencies = currencies;
        user.save();
        res.send({
          success: true,
          // data
        });
      });
  }
  res.send({
    success: false,
  });
}

module.exports = {
  getSettings,
  addCurrency,
  delCurrency,
};
