const ObjectId = require('mongoose').Types.ObjectId;

const { db } = require('../../lib/db');

const {
  MarketModel,
  PortfolioModel,
  CoinModel,
  TransactionModel,
  CurrencyModel,
  CategoryModel,
  FiatModel,
} = db();

const { pricehisto } = require('../../lib/services/cryptocompare');

function addCoin(req, res, next) {
  if (!(
    req.body &&
    req.body.portfolio &&
    req.body.market &&
    (req.body.currency || req.body.exchange) &&
    req.body.price &&
    req.body.amount &&
    req.body.total &&
    req.body.date &&
    req.body.time &&
    req.body.type
  )) {
    return res.send({
      success: false,
      response: {
        message: 'portfolio && market && (currency || exchange) && price && amount && total && date && time && type params is required'
      }
    });
  }

  const type = req.body.type;
  const isExchange = (type === 'exchange' && req.body.exchange);
  const isCurrency = (type === 'buy' || type === 'sell') && req.body.currency;

  const coinData = {
    owner: req.user._id,
    portfolio: req.body.portfolio,
    market: req.body.market,
  };
  const pairData = { owner: req.user._id };

  const categoryQuery = ObjectId.isValid(req.body.category) ?
      { _id: ObjectId(req.body.category) } :
      { title: req.body.category };

  let allQuery = [
    CoinModel.findOne(coinData),
    PortfolioModel.findOne({ _id: coinData.portfolio }),
    CategoryModel.findOne(categoryQuery),
  ];

  if (isExchange) {
    allQuery.push(MarketModel.findById(req.body.exchange, '_id'));
    pairData.portfolio = req.body.portfolio;
    pairData.market = req.body.exchange;
    allQuery.push(CoinModel.findOne(pairData, '_id amount transactions'));
  }
  if (isCurrency) {
    allQuery.push(CurrencyModel.findById(req.body.currency, '_id'));
    pairData.currency = req.body.currency;
    allQuery.push(FiatModel.findOne(pairData, '_id amount transactions'));
  }

  Promise.all(allQuery)
  .then(data => {
    const coin = data[0] || new CoinModel(coinData);
    const portfolio = data[1];
    const category = data[2];
    const pairModel = data[3];
    let pair = data[4];

    const transaction = {
      owner: req.user._id,
      coin: coin._id,
      date: new Date(`${req.body.date} ${req.body.time}`),
      type,
      amount: req.body.amount,
      price: req.body.price,
      total: req.body.total,
      note: req.body.note,
    };

    if (isExchange) {
      if (req.body.deduct) {
        if (!(pair && pair._id)) pair = new CoinModel(pairData);
        transaction.pair = pair._id;
      }
      transaction.exchange = pairModel;
    }
    if (isCurrency) {
      if (req.body.deduct) {
        if (!(pair && pair._id)) pair = new FiatModel(pairData);
        transaction.fiat = pair._id;
      }
      transaction.currency = pairModel;
    }

    const newTransaction = new TransactionModel(transaction);

    if (newTransaction.type === 'buy' || newTransaction.type === 'exchange') {
      coin.amount += newTransaction.amount;
      if (pair) pair.amount -= newTransaction.total;
    } else if (newTransaction.type === 'sell') {
      coin.amount -= newTransaction.amount;
      if (pair) pair.amount += newTransaction.total;
    }

    if (!category && req.body.category) {
      const newCategory = new CategoryModel({ title: req.body.category, owner: req.user._id });
      newTransaction.category = newCategory._id;
      newCategory.save();
    }

    coin.transactions.push(newTransaction._id);
    if (req.body.deduct && pair) pair.transactions.push(newTransaction._id);

    if (portfolio.coins.indexOf(coin._id) === -1) portfolio.coins.push(coin._id);
    if (pair && isExchange && portfolio.coins.indexOf(pair._id) === -1 && req.body.deduct) portfolio.coins.push(pair._id);

    Promise
      .all([
        coin.save(),
        newTransaction.save(),
        portfolio.save(),
      ])
      .then(() => {
        if (pair && req.body.deduct) pair.save();
        CoinModel
          .findOne({ _id: coin._id }, 'amount portfolio')
          .populate([
            {
               path: 'transactions',
               model: 'Transaction',
               match: { isActive: true },
               select: 'date type amount price total note histo pair coin',
               populate: [
                 {
                   path: 'market',
                   model: 'Market',
                   select: 'symbol code prices',
                 },
                 {
                   path: 'currency',
                   model: 'Currency',
                   select: 'symbol name code prices',
                 },
                 {
                   path: 'exchange',
                   model: 'Market',
                   select: 'symbol',
                 },
                 {
                   path: 'category',
                   model: 'Category',
                   select: 'title color',
                 },
               ],
             },
             {
               path: 'market',
               model: 'Market',
               select: 'imageUrl name order symbol prices',
             },
          ])
          .then(coinData => {
            Promise
              .all(coinData.transactions.map(transaction => {
                if (!transaction.histo) {
                  const fsym = isCurrency ? transaction.currency.code : transaction.exchange.symbol;
                  const tsym = 'BTC,USD,RUB';
                  const ts = new Date(transaction.date).getTime();
                  return pricehisto(fsym, tsym, ts)
                    .then(histo => {
                      transaction.histo = histo[fsym];
                      transaction.save();
                      return transaction;
                    });
                } else {
                  return Promise.resolve(transaction);
                }
              }))
              .then(transactions => transactions.map(transaction => {
                if (transaction.pair && transaction.pair.equals(coin._id)) {
                  // this is paired coin transaction, an exchange
                  transaction.amount = transaction.amount * -1;
                  transaction.total = transaction.total * -1;
                }
                return transaction;
              }))
              .then(transactions => {
                const { _id, amount, market } = coinData;
                res.send({
                  success: true,
                  response: {
                    coin: { _id, amount, market, transactions },
                  }
                });
              });
          })
      });
  })
}

function getCoin(req, res, next) {
  if (!(req.query && req.query.coinId)) {
    return res.send({
      success: false,
      response: {
        message: 'coinId param is required'
      }
    });
  }

  const coinData = {
    owner: req.user._id,
    isActive: true,
  };
  if (req.query.coinId) coinData._id = req.query.coinId;
  if (req.query.portfolioId) coinData.portfolio = req.query.portfolioId;
  CoinModel
    .find(coinData, 'amount')
    .populate([
      {
         path: 'transactions',
         model: 'Transaction',
         match: { isActive: true },
         select: 'date type amount total category note',
         populate: [
           {
             path: 'market',
             model: 'Market',
             select: 'symbol prices',
           },
           {
             path: 'currency',
             model: 'Currency',
             select: 'symbol code prices',
           },
           {
             path: 'category',
             model: 'Category',
             select: 'title',
           },
         ],
       },
       {
         path: 'market',
         model: 'Market',
         select: 'imageUrl name order symbol prices',
       },
    ])
    .then(coins => {
      if (!coins) {
        res.send({
          success: false,
          response: {
            message: 'coins not found'
          }
        });
        return next();
      }
      const response = coinData._id ? { coin: coins[0] } : { coins };
      res.send({
        success: true,
        response
      });
    });
}

function updateCoin(req, res, next) {
  return res.send({
    success: false,
    response: {
      message: 'not implemented'
    }
  });
}

function delCoin(req, res, next) {
  if (!(req.body && req.body.coinId)) {
    return res.send({
      success: false,
      response: {
        message: 'coinId param is required'
      }
    });
  }

  const query = {
    _id: req.body.coinId,
    owner: req.user._id
  };

  CoinModel
    .findOne(query)
    .then(coin => {
      if (!coin) {
        res.send({
          success: false,
          response: {
            message: 'coin not found'
          }
        });
        return next();
      }

      coin.isActive = false;

      return coin.save()
        .then(() => {
          return res.send({
            success: true,
            response: {
              coinId: coin._id
            }
          });
        });
    })
    .catch(err => {
      res.send({
        success: false,
        response: {
          message: err
        }
      });
    });
}

module.exports = {
  addCoin,
  getCoin,
  updateCoin,
  delCoin,
};
