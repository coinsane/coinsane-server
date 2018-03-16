const config = require('../../config');
const { mongo } = require('../../lib/db');

const { MarketModel, PortfolioModel, CoinModel, TransactionModel, CurrencyModel, CategoryModel } = mongo();

function addCoin(req, res, next) {
  if (!(
    req.body &&
    req.body.coin &&
    req.body.portfolio &&
    (req.body.currency || req.body.market) &&
    req.body.date &&
    req.body.amount &&
    req.body.total
  )) {
    return res.send({
      success: false,
      response: {
        message: 'coin && portfolio && (currency || market) && date && amount && total params is required'
      }
    });
  }

  const coinData = {
    owner: req.user._id,
    market: req.body.coin,
    portfolio: req.body.portfolio,
  };

  let currencyQuery;

  if (req.body.currency) {
    currencyQuery = CurrencyModel.findById(req.body.currency);
  } else if (req.body.market) {
    currencyQuery = MarketModel.findById(req.body.market);
  }

  Promise.all([
    CoinModel.findOne(coinData),
    PortfolioModel.findOne({ _id: coinData.portfolio }),
    CategoryModel.findOne({ title: req.body.category, owner: req.user._id }),
    currencyQuery,
  ])
  .then(data => {
    const coin = data[0] || new CoinModel(coinData);
    const portfolio = data[1];
    const category = data[2];
    const currency = data[3];
    const transaction = {
      owner: req.user._id,
      coin: coin._id,
      date: new Date(req.body.date),
      buy: req.body.buy,
      amount: req.body.amount,
      total: req.body.total,
      note: req.body.note,
    };

    if (req.body.currency) {
      transaction.currency = req.body.currency;
    } else if (req.body.market) {
      transaction.market = req.body.market;
    }

    const newTransaction = new TransactionModel(transaction);

    if (newTransaction.buy) coin.amount += newTransaction.amount;
    else coin.amount -= newTransaction.amount;

    if (!category && req.body.category) {
      const newCategory = new CategoryModel({ title: req.body.category, owner: req.user._id });
      newTransaction.category = newCategory._id;
      newCategory.save();
    }

    coin.transactions.push(newTransaction._id);

    if (portfolio.coins.indexOf(coin._id) === -1) {
      portfolio.coins.push(coin._id);
    }

    Promise.all([
        coin.save(),
        newTransaction.save(),
        portfolio.save(),
      ])
      .then(() => {
        CoinModel
          .findOne({ _id: coin._id }, 'amount')
          .populate([
            {
               path: 'transactions',
               model: 'Transaction',
               match: { isActive: true },
               select: 'date buy amount total category note',
               populate: [
                 {
                   path: 'market',
                   model: 'Market',
                   select: 'symbol prices.BTC.price',
                 },
                 {
                   path: 'currency',
                   model: 'Currency',
                   select: 'symbol code prices.BTC.price',
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
               select: 'imageUrl name order symbol prices.BTC.price',
             },
          ])
          .then(coinData => {
            res.send({
              success: true,
              response: {
                coin: coinData,
              }
            });
          })
      });
  })
}

function getCoin(req, res, next) {
  if (!(req.query && req.body.coinId)) {
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
         select: 'date buy amount total category note',
         populate: [
           {
             path: 'market',
             model: 'Market',
             select: 'symbol prices.BTC.price',
           },
           {
             path: 'currency',
             model: 'Currency',
             select: 'symbol code prices.BTC.price',
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
         select: 'imageUrl name order symbol prices.BTC.price',
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
