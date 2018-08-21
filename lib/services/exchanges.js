const config = require('../../config');
const { Bittrex, Binance } = require('./providers');
const { db } = require('../../lib/db');
const { MarketModel, CoinModel } = db();

function getCoins({ owner, portfolio, provider, key, secret }) {
  return new Promise((resolve, reject) => {
    if (!provider || !key || !secret) {
      return reject('Exchange is unreachable');
    }
    switch (provider.name) {
      case 'Bittrex':
        const bittrex = new Bittrex({ key, secret });
        return bittrex.getBalances()
          .then(data => updateCoinData({ data, owner, portfolio }))
          .then(resolve)
          .catch(reject);
        break;
      case 'Binance':
        const binance = new Binance({ key, secret });
        return binance.getBalances()
          .then(data => updateCoinData({ data, owner, portfolio }))
          .then(resolve)
          .catch(reject);
        break;
      default:
        return resolve({});
    }
  });
}

const updateCoinData = ({ data, owner, portfolio }) => {
  return getPortfolioCoins(owner, portfolio._id)
    .then(coins => {
      const newCoinsPromises = [];
      let restCoins = [...coins];
      data.forEach(({ symbol, amount }) => {
        if (amount) {
          const marketPromise = MarketModel.findOne({ symbol })
            .then(market => {
              if (market) {
                const coin = coins.length ? coins.filter(item => item.market.equals(market._id))[0] : null;
                restCoins = restCoins.length ? restCoins.filter(item => !item.market.equals(market._id)) : [];
                if (!coin) {
                  const newCoin =  new CoinModel({
                    market: market._id,
                    owner,
                    portfolio: portfolio._id,
                    amount,
                  });
                  return newCoin.save().then(coin => coin);
                }
                if (coin.amount !== amount) {
                  coin.amount = amount;
                  return coin.save().then(coin => coin);
                }
                return coin;
              } else {
                // TODO market not found
                console.log('Currency not found', symbol);
                return null;
              }
            });
          newCoinsPromises.push(marketPromise);
        }
      });
      return Promise.all(newCoinsPromises).then(coins => {
        if (restCoins.length) {
          restCoins.forEach(restCoin => {
            CoinModel.findById(restCoin._id).then(coin => {
              coin.isActive = false;
              coin.save();
            })
          })
        }
        return coins.filter(item => (item !== null));
      })
    });
};

const getPortfolioCoins = (owner, portfolio) => {
  return CoinModel.find({ owner, portfolio }).then(coins => coins);
};


module.exports = {
  getCoins,
};
