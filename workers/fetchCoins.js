const config = require('../config');
const { firebase, mongo } = require('../lib/db');
const rp = require('request-promise-native');

const { marketRef } = firebase();
const { marketModel } = mongo();

function fetchMarket() {
  const uri = `${config.cryptocompare.apiUri}/data/coinlist`;
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
          algorithm: coinData.Algorithm ? `${coinData.Algorithm}` : '',
          proofType: coinData.ProofType ? `${coinData.ProofType}` : '',
          totalCoinSupply: coinData.TotalCoinSupply ? `${coinData.TotalCoinSupply}` : '',
        };
      });

      items.forEach(item => {
        if (item.symbol.indexOf('*') === -1) {
          const marketIdRef = marketRef.child(item.id);
          marketIdRef.set(item).catch(console.log);

          marketModel.findOne({ id: item.id })
            .then(market => {
              if (market) {
                Object.keys(item).map(i => market[i] = item[i]);
                return market.save();
              }
              const newMarket = new marketModel(item);
              newMarket.save();
            });
        }
      });
      // console.log('fetchMarket done')
    });
}

module.exports = fetchMarket;
