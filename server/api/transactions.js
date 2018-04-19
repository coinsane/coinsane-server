const config = require('../../config');
const { mongo } = require('../../lib/db');

const { CoinModel, TransactionModel } = mongo();

const { pricehisto } = require('../../lib/services/cryptocompare');

function getTransactionsList(req, res, next) {
  const transactionData = {
    coin: req.query.coinId,
    owner: req.user._id,
    isActive: true,
  };

  TransactionModel.find(transactionData, 'date buy amount total note category')
    .sort('date')
    .populate([
      {
        path: 'currency',
        model: 'Currency',
        select: 'symbol name code prices.BTC.price',
      },
      {
        path: 'market',
        model: 'Market',
        select: 'symbol code prices.BTC.price',
      },
      {
        path: 'category',
        model: 'Category',
        select: 'title color',
      },
    ])
    .then(transactions => {
      if (!transactions.length) {
        res.send({
          success: false,
          response: {
            message: 'transactions not found'
          }
        });
        return next();
      }
      return Promise.all(transactions.map(transaction => {
        console.log('transaction', transaction)
        const fsym = transaction.currency.code || transaction.market.symbol;
        const tsym = 'BTC,USD,RUB';
        const ts = new Date(transaction.date).getTime();
        return pricehisto(fsym, tsym, ts)
          .then(histo => {
            transaction.histo = histo[fsym];
            return transaction;
          });
      }))
      .then(transactions => {
        res.send({
          success: true,
          response: {
            transactions
          }
        });
      });
    });
}

function getTransaction(req, res, next) {
  const transactionData = {
    _id: req.query.transactionId,
    owner: req.user._id,
    isActive: true,
  };

  TransactionModel.findOne(transactionData, 'date buy amount total note')
    .populate([
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
        select: 'title color',
      },
    ])
    .then(transaction => {
      if (!transaction) {
        res.send({
          success: false,
          response: {
            message: 'transaction not found'
          }
        });
        return next();
      }
      res.send({
        success: true,
        response: {
          transaction
        }
      });
    });
}

function updateTransaction(req, res, next) {
  res.send({
    success: false,
    response: {
      message: 'not ready yet'
    }
  });
}

function delTransaction(req, res, next) {
  if (!req.body.transactionId) {
    res.send({
      success: false,
      response: {
        message: 'transactionId param is required'
      }
    });
    return next();
  }

  const query = {
    _id: req.body.transactionId,
    owner: req.user._id
  };

  TransactionModel
    .findOne(query)
    .then(transaction => {
      if (!transaction) {
        res.send({
          success: false,
          response: {
            message: 'transaction not found'
          }
        });
        return next();
      }

      transaction.isActive = false;

      CoinModel.findById(transaction.coin)
        .then(coin => {
          coin.amount -= transaction.amount;
          coin.save();
        });

      return transaction.save()
        .then(() => {
          return res.send({
            success: true,
            response: {
              transactionId: transaction._id
            }
          });
        });
    })
    .then(next)
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
  getTransactionsList,
  getTransaction,
  updateTransaction,
  delTransaction,
};
