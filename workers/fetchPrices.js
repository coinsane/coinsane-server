const config = require('../config');
const { firebase, mongo } = require('../lib/db');
const rp = require('request-promise-native');

const { marketRef } = firebase();
const { marketModel } = mongo();

function fetchPrices() {
  marketModel.find({})
    .then(markets => {
      const priceRequestPromises = [];

      const symbolsTo = ['BTC','USD','RUB'];

      let symbolsTemp = '';
      let idsTemp = '';

      markets.forEach((market, index) => {
        if (!symbolsTemp) symbolsTemp = market.symbol;
        else symbolsTemp += `,${market.symbol}`;
        if (!idsTemp) idsTemp = market.id;
        else idsTemp += `,${market.id}`;

        if (index === markets.length - 1 || symbolsTemp.length > 290) {
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
          results.forEach((item, index) => {
            resultsAll = Object.assign(resultsAll, item);
          });
          return resultsAll;
        })
        .then(prices => {
          Object.keys(prices).forEach(id => {
            const marketIdPricesRef = marketRef.child(`${id}/prices`);
            marketIdPricesRef.set(prices[id]);

            marketModel.findOne({ id })
              .then(market => {
                if (market) {
                  market.prices = prices[id];
                  return market.save();
                }
              });
          });
        });
    });

  // marketRef.once('value', function(snapshot) {
  //   const market = snapshot.val();
  //   // const price
  //   if (market && Object.keys(market).length) {
  //     const symbols = Object.keys(market).map(key => market[key].symbol);
  //     const ids = Object.keys(market).map(key => market[key].id);
  //
  //     const priceRequestPromises = [];
  //
  //     const symbolsTo = ['BTC','USD','RUB'];
  //
  //     let symbolsTemp = '';
  //     let idsTemp = '';
  //
  //     symbols.forEach((symbol, index) => {
  //       if (!symbolsTemp) symbolsTemp = symbol;
  //       else symbolsTemp += `,${symbol}`;
  //       if (!idsTemp) idsTemp = ids[index];
  //       else idsTemp += `,${ids[index]}`;
  //
  //       if (index === symbols.length - 1 || symbolsTemp.length > 290) {
  //         const reqSymbols = symbolsTemp.split(',');
  //         const reqIds = idsTemp.split(',');
  //         priceRequestPromises.push(rp({
  //           uri: `${config.apiUri}data/pricemultifull`,
  //           qs: {
  //             fsyms: symbolsTemp,
  //             tsyms: symbolsTo.join(',')
  //           },
  //           json: true
  //         }).then(priceData => {
  //           const data = {};
  //           reqSymbols.forEach((symbol, index) => {
  //             if (priceData.RAW[symbol]) {
  //               // data[`${reqIds[index]}`] = priceData.RAW[symbol]; // format this
  //
  //               data[`${reqIds[index]}`] = {};
  //
  //               const pricesRaw = priceData.RAW[symbol];
  //
  //               // console.log('data', data)
  //               // console.log('pricesRaw', pricesRaw[symbolsTo[0]])
  //
  //               symbolsTo.forEach(symbolTo => {
  //                 data[`${reqIds[index]}`][symbolTo] = {};
  //                 const price = pricesRaw[symbolTo];
  //                 // console.log('price', price);
  //                 if (price) {
  //                   if (price.PRICE) data[`${reqIds[index]}`][symbolTo].price = price.PRICE;
  //                   if (price.LASTUPDATE) data[`${reqIds[index]}`][symbolTo].lastUpdate = price.LASTUPDATE;
  //                   if (price.LASTVOLUME) data[`${reqIds[index]}`][symbolTo].lastVolume = price.LASTVOLUME;
  //                   if (price.LASTVOLUMETO) data[`${reqIds[index]}`][symbolTo].lastVolumeTo = price.LASTVOLUMETO;
  //                   if (price.VOLUMEDAY) data[`${reqIds[index]}`][symbolTo].volumeDay = price.VOLUMEDAY;
  //                   if (price.VOLUMEDAYTO) data[`${reqIds[index]}`][symbolTo].volumeDayTo = price.VOLUMEDAYTO;
  //                   if (price.VOLUME24HOUR) data[`${reqIds[index]}`][symbolTo].volume24H = price.VOLUME24HOUR;
  //                   if (price.VOLUME24HOURTO) data[`${reqIds[index]}`][symbolTo].volume24HTo = price.VOLUME24HOURTO;
  //                   if (price.OPENDAY) data[`${reqIds[index]}`][symbolTo].openDay = price.OPENDAY;
  //                   if (price.HIGHDAY) data[`${reqIds[index]}`][symbolTo].highDay = price.HIGHDAY;
  //                   if (price.LOWDAY) data[`${reqIds[index]}`][symbolTo].lowDay = price.LOWDAY;
  //                   if (price.OPEN24HOUR) data[`${reqIds[index]}`][symbolTo].open24H = price.OPEN24HOUR;
  //                   if (price.HIGH24HOUR) data[`${reqIds[index]}`][symbolTo].high24H = price.HIGH24HOUR;
  //                   if (price.LOW24HOUR) data[`${reqIds[index]}`][symbolTo].low24H = price.LOW24HOUR;
  //                   if (price.CHANGE24HOUR) data[`${reqIds[index]}`][symbolTo].change24H = price.CHANGE24HOUR;
  //                   if (price.CHANGEPCT24HOUR) data[`${reqIds[index]}`][symbolTo].changePct24H = price.CHANGEPCT24HOUR;
  //                   if (price.CHANGEDAY) data[`${reqIds[index]}`][symbolTo].changeDay = price.CHANGEDAY;
  //                   if (price.CHANGEPCTDAY) data[`${reqIds[index]}`][symbolTo].changePctDay = price.CHANGEPCTDAY;
  //                   if (price.SUPPLY) data[`${reqIds[index]}`][symbolTo].supply = price.SUPPLY;
  //                   if (price.MKTCAP) data[`${reqIds[index]}`][symbolTo].marketCap = price.MKTCAP;
  //                   if (price.TOTALVOLUME24H) data[`${reqIds[index]}`][symbolTo].totalVolume24H = price.TOTALVOLUME24H;
  //                   if (price.TOTALVOLUME24HTO) data[`${reqIds[index]}`][symbolTo].totalVolume24HTo = price.TOTALVOLUME24HTO;
  //                 }
  //               });
  //             }
  //           });
  //           return data;
  //         }));
  //         symbolsTemp = '';
  //         idsTemp = '';
  //       }
  //     });
  //
  //     Promise.all(priceRequestPromises)
  //       .then(results => {
  //         let resultsAll = {};
  //         const prices = {};
  //         results.forEach((item, index) => {
  //           resultsAll = Object.assign(resultsAll, item);
  //         });
  //         return resultsAll;
  //       })
  //       .then(prices => {
  //         Object.keys(prices).forEach(id => {
  //           const child = marketRef.child(`${id}/prices`);
  //           child.set(prices[id], err => {
  //             if (err) console.log(err);
  //           });
  //         })
  //         console.log('fetchPrices done');
  //       });
  //   }
  // });
}

module.exports = fetchPrices;
