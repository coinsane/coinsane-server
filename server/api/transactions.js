const config = require('../../config');
const { mongo } = require('../../lib/db');

const { CoinModel, TransactionModel } = mongo();

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

function updateTransaction(req, res, next) {}

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
  getTransaction,
  updateTransaction,
  delTransaction,
};
