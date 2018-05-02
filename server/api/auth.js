const jwt = require('jsonwebtoken');

const config = require('../../config');
const { mongo } = require('../../lib/db');
const { UserModel, PortfolioModel, CurrencyModel, MarketModel } = mongo();

function getToken(req, res) {
  const token = _getToken(req);

  _getUser(token)
    .then(_createNewPortfolio)
    .then(user => {
      return res.send({
        success: true,
        result: {
          token: jwt.sign({ _id: user._id, type: user.type, settings: user.settings }, config.authSecret),
        },
      })
    })
    .catch(() => {
      res.send({
        success: false,
        result: {
          message: 'Authorization fail',
        },
      });
    });
}

function checkAuth(req, res, next) {
  const token = _getToken(req);
  if (!token) return res.send({
    success: false,
    result: {
      message: 'Authorization fail',
    },
  });

  jwt.verify(token, config.authSecret, (err, user) => {
    if (err || !user) {
      req.user = undefined;
      return res.send({
        success: false,
        result: {
          message: 'Authorization fail',
        },
      });
    }
    req.user = user;
    next();
  });
}

function getUser(req, res, next) {
  res.send({
    success: true,
    result: {
      user: req.user,
    },
  });
  next();
}

function _getUser(token) {
  if (!token) return _createAnonymousUser();
  return _getUserByToken(token);
}

function _createAnonymousUser() {
  return _getDefaultCurrencies()
    .then(currencies => {
      const user = new UserModel({
        type: 'anonymous',
        settings: { currencies },
      });
      return user.save().then(user => user);
    });
}

function _getUserByToken(token) {
  return new Promise((resolve, reject) => {
    jwt.verify(token, config.authSecret, (err, decoded) => {
      if (err || !decoded) return reject(err);
      UserModel.findOne({ _id: decoded._id })
        .then(user => {
          if (!user) return _createAnonymousUser().then(resolve);
          return resolve(user);
        });
    });
  });
}

function _getToken(req) {
  const authHeader = req.header('Authorization');
  if (!authHeader || authHeader.indexOf(config.appName) === -1) return '';

  const authParams = authHeader.split(' ');
  const token = authParams.length > 1 ? authParams[1].split('=')[1] : '';
  return token;
}

function _createNewPortfolio(user) {
  const query = {
    owner: user._id,
    isActive: true
  };
  return PortfolioModel.count(query).then(count => {
    if (!count) {
      const newPortfolio = new PortfolioModel({
        owner: user._id,
        title: 'My portfolio',
        inTotal: true,
      });
      newPortfolio.save()
    }
    return user;
  });
}

function _getDefaultCurrencies() {
  return Promise
    .all([
      MarketModel.findOne({ symbol: 'BTC' }, '_id symbol'),
      CurrencyModel.findOne({ code: 'USD' }, '_id code'),
    ])
    .then(res => {
      return res.map((item, index) => {
        const currency = { system: true };
        if (index === 0) {
          currency.market = item;
        } else {
          currency.currency = item;
        }
        return currency;
      });
    });
}

module.exports = {
  getToken,
  getUser,
  checkAuth
};
