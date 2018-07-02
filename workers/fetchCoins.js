const config = require('../config');
const { db } = require('../lib/db');
const rp = require('request-promise-native');

const { MarketModel } = db();

function fetchMarket() {

  /*
  * TODO get from coinmarketcap (limit requests to no more than 30 per minute)
  * https://api.coinmarketcap.com/v2/ticker/?start=101&sort=id&structure=array
  * data: object {
      * name
      * symbol
      * rank
      * circulating_supply
      * total_supply
      * max_supply
  * }
  * metadata: object {
      * num_cryptocurrencies: 1604
  * }
  * */
  updateMarketRank();

  rp({ uri: `${config.cryptocompare.apiUri}/data/coinlist`, json: true })
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
        MarketModel.findOne({ id: item.id })
          .then(market => {
            if (market) {
              Object.keys(item).map(i => market[i] = item[i]);
              return market.save();
            }
            const newMarket = new MarketModel(item);
            newMarket.save();
          });
      });
    });
}

function updateMarketRank(qs) {
  qs = qs || {
    sort: 'id',
    structure: 'array',
    start: 1,
  };

  return rp({ uri: `${config.coinmarketcap.apiUri}/ticker`, qs, json: true })
    .then(res => {
      const num_cryptocurrencies = (res.metadata && res.metadata['num_cryptocurrencies']) ? res.metadata['num_cryptocurrencies'] : 0;
      if (num_cryptocurrencies > qs.start) {
        qs.start += 100;
        updateMarketRank(qs)
      }
      res.data.forEach(item => {
        MarketModel.findOne({ symbol: item.symbol })
          .then(market => {
            if (market) {
              market.rank = item.rank;
              return market.save();
            }
          });
      });
    });
}

module.exports = fetchMarket;
