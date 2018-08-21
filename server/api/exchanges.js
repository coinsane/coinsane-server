const config = require('../../config');

const { db } = require('../../lib/db');

const { ProviderModel } = db();

function getExchanges(req, res, next) {

  return ProviderModel.find({ isActive: true })
    .then(data => {
      const response = {
        success: true,
        data,
      };
      return res.send(response);
    });

  const apikey = '9284e59d4731431f8935db2afb0994c5q';
  const apisecret = '853b897a3a6b4cc8bb2989cf0276d0d6a';

  const newApi = {
    owner: '',
    portfolio: '',
    key: '',
    secret: '',
  };

  const newPortfolio = {
    title: 'Bittrex',
    type: 'service',
    api: 'id', // new
    amount: { type: Number },
    changePct: { type: Number },
    owner: '',
    coins: [],
    inTotal: { type: Boolean, default: false },
  };

  NodeBittrexApi.options({
    apikey,
    apisecret,
    stream: true,
    verbose: false,
    cleartext: false
  });

  NodeBittrexApi.getbalances(data => {
    console.log('getbalances', data)
    // return res.send(data);
    // { Currency: 'ZEC',
    //   Balance: 3,
    //   Available: 3,
    //   Pending: 0,
    //   CryptoAddress: 't1T3by7ev5wLY9c3m7o96SQDTLKJkHKD1Vg' }

    const {
      Currency,
      Balance,
    } = data.result[0];

    function getMarketFromString(currency) {
      return currency;
    }

    const newCoin = {
      market: getMarketFromString(Currency),
      owner: '',
      portfolio: 'portfolio_id',
      transactions: [],
      amount: Balance,
    }
  });

  return NodeBittrexApi.getorderhistory(null, data => {
    // {
    //   "success": true,
    //   "message": "",
    //   "result": [
    //   {
    //     "OrderUuid": "8504c379-83ec-4f42-94e8-1d107a2fce64",
    //     "Exchange": "BTC-BCH",
    //     "TimeStamp": "2018-07-27T03:58:52.913",
    //     "OrderType": "LIMIT_SELL",
    //     "Limit": 0.10098001,
    //     "Quantity": 0.005,
    //     "QuantityRemaining": 0,
    //     "Commission": 0.00000126,
    //     "Price": 0.0005049,
    //     "PricePerUnit": 0.10098,
    //     "IsConditional": false,
    //     "Condition": "NONE",
    //     "ConditionTarget": null,
    //     "ImmediateOrCancel": false,
    //     "Closed": "2018-07-27T03:58:53.023"
    //   }
    // ]
    // }

    const {
      OrderUuid,
      Closed,
      Exchange,
      OrderType,
      Price,
      PricePerUnit,
      Quantity,
      Commission,
    } = data.result[0];

    function getCoinFromString(exchange, orderType) {
      let coin;
      if (orderType === 'LIMIT_SELL') {
        coin = exchange.split('-')[1];
      } else {
        coin = exchange.split('-')[0];
      }
      // to id
      return coin;
    }
    function getExchangeFromString(exchange) {
      return 'coin'
    }

    // if OrderUuid doesnt exists
    const newTransaction = {
      owner: '',
      service: 'bittrex', // new
      orderId: OrderUuid, // new
      date: new Date(Closed),
      coin: getCoinFromString(Exchange, OrderType), // coin BCH
      exchange: getExchangeFromString(Exchange, OrderType), // market BTC
      pair: '', // coin BCH
      type: 'exchange',
      amount: Quantity,
      price: PricePerUnit,
      total: Price,
      commission: Commission, //new
      histo: { // ??? price from api in all user's currencies on transaction date
        BTC: 0,
        USD: 0,
        RUB: 0,
      }
    };


  // ﻿{
  //     "_id" : ObjectId("5b516b4ccf8e55001ec7ed96"),
  //       "owner" : ObjectId("5b4da20ad71dd6001e2d200f"),
  //       "coin" : ObjectId("5b516a92cf8e55001ec7ed90"),
  //       "date" : ISODate("2018-07-20T07:54:00.000Z"),
  //       "type" : "exchange",
  //       "amount" : 1,
  //       "price" : 56.87,
  //       "total" : 56.87,
  //       "note" : "",
  //       "pair" : ObjectId("5b516aa4cf8e55001ec7ed92"),
  //       "exchange" : ObjectId("5a9c5e5244d0ad001eed9011"),
  //       "isActive" : true,
  //       "lastUpdated" : ISODate("2018-07-20T04:55:40.967Z"),
  //       "created" : ISODate("2018-07-20T04:55:40.861Z"),
  //       "__v" : 0,
  //       "histo" : {
  //       "BTC" : 0.001097,
  //         "USD" : 8.19,
  //         "RUB" : 496.5
  //     }
  //   }


    console.log('getorderhistory', data)
    if (data && data.result && data.result.length) {
      return res.send(data);

    } else {
      return res.send();
    }
  });


  const cacheKey = getCacheKey('exchangeWallet', req.query);

  return new Promise((resolve, reject) => {
    cacheGet(cacheKey)
      .then(cacheValue => {
        if (cacheValue) {
          try {
            const response = JSON.parse(cacheValue);
            return resolve(response);
          } catch (e) {}
        }
        return fetchLimit({ uri, qs, json: true })
          .then(data => {
            const response = {
              success: data.Response === 'Success',
              data: {},
            };
            // data.Data.forEach(item => {
            //   response.data[item.time] = (item.low + item.high) / 2;
            // });
            // if (response.success) {
            //   if (period === 'histoday') cacheSet(cacheKey, response, config.cacheTime.coinDay); // once in 12h
            //   if (period === 'histohour') cacheSet(cacheKey, response, config.cacheTime.coinHour); // once in 30m
            //   if (period === 'histominute') cacheSet(cacheKey, response, config.cacheTime.coinMinute); // once in 30s
            // }
            resolve(response);
          });
      });
  })
    .then(formatHistoData)
    .then(data => {
      res.send(data);
      next();
    });

}

module.exports = {
  getExchanges,
};
