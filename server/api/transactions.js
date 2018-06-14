const { db } = require('../../lib/db');

const { CoinModel, TransactionModel, FiatModel } = db();

const { pricehisto } = require('../../lib/services/cryptocompare');

function getTransactionsList(req, res, next) {
  const transactionData = {
    owner: req.user._id,
    isActive: true,
    $or: [
      { coin: req.query.coinId },
      { pair: req.query.coinId },
    ]
  };

  TransactionModel.find(transactionData, 'date type amount price total note histo pair coin')
    .sort('date')
    .populate([
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
    ])
    .then(transactions => {
      if (!transactions.length) {
        res.send({
          success: false,
          response: {
            transactions: []
          }
        });
        return next();
      }
      return Promise
        .all(transactions.map(transaction => {
          if (!transaction.histo) {
            const fsym = transaction.currency ? transaction.currency.code : transaction.exchange.symbol;
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
          if (transaction.pair && transaction.pair.toString() === req.query.coinId) {
            // this is paired coin transaction, an exchange
            transaction.amount = transaction.amount *= -1;
            transaction.total = transaction.total * -1;
          }
          return transaction;
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

  TransactionModel.findOne(transactionData, 'date type amount total note')
    .populate([
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
    owner: req.user._id,
    isActive: true,
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

      const removeFromTransactions = (coin) => {
        let amount = 0;
        let coinTransactions = [];
        coin.transactions.forEach(item => {
          if (!item._id.equals(transaction._id)) {
            coinTransactions.push(item._id);
            amount += item.amount;
          }
        });

        if (coin.amount !== amount) {
          coin.amount = amount;
          coin.transactions = coinTransactions;
          coin.save();
        }
      };

      const populate = [{
        path: 'transactions',
        model: 'Transaction',
        match: { isActive: true },
        select: '_id amount',
      }];

      // Remove from Coin
      if (transaction.coin) {
        CoinModel.findById(transaction.coin, 'amount')
          .populate(populate)
          .then(removeFromTransactions);
      }

      // Remove from Pair
      if (transaction.pair) {
        CoinModel.findById(transaction.pair, 'amount')
          .populate(populate)
          .then(removeFromTransactions);
      }

      // Remove from Fiat
      if (transaction.fiat) {
        FiatModel.findById(transaction.fiat, 'amount')
          .populate(populate)
          .then(removeFromTransactions);
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
            response: { transaction },
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
