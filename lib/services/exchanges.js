const config = require('../../config');
const { Bittrex } = require('./providers');
const { db } = require('../../lib/db');
const { MarketModel, CoinModel } = db();

function getCoins({ owner, portfolio, provider, key, secret }) {
  return new Promise((resolve, reject) => {
    if (!provider || !key || !secret) {
      return reject('Exchange is unreachable');
    }
    switch (provider) {
      case '5b5af80295799b40c3e8a867':
        const bittrex = new Bittrex({ key, secret });
        return bittrex.getBalances()
          .then(data => {
            const newCoinsPromises = [];
            data.forEach(({ Currency, Balance, Available, Pending }) => {
              if (Balance || Available || Pending) {
                const marketPromise = MarketModel.findOne({ symbol: Currency }).then(market => {
                  if (market) {
                    const newCoin =  new CoinModel({
                      market: market._id,
                      owner,
                      portfolio: portfolio._id,
                      amount: Balance,
                    });
                    return newCoin.save().then(coin => coin);
                  } else {
                    console.log('Currency not found', Currency);
                  }
                });
                newCoinsPromises.push(marketPromise);
              }
            });
            return Promise.all(newCoinsPromises).then(resolve);
          })
          .catch(reject);
        break;
      default:
        return resolve({});
    }
  });
}


module.exports = {
  getCoins,
};
