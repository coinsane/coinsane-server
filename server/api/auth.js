const jwt = require('jsonwebtoken');

const config = require('../../config');
const { db } = require('../../lib/db');
const { UserModel, PortfolioModel, CurrencyModel, MarketModel } = db();

function getToken(req, res) {
  const { token, deviceId } = _getToken(req);

  _getUser({ token, deviceId })
    .then(_createNewPortfolio)
    .then(user => {
      return res.send({
        success: true,
        result: {
          token: jwt.sign({ _id: user._id, type: user.type }, config.authSecret),
        },
      })
    })
    .catch(() => authorizationFail(res));
}

function checkAuth(req, res, next) {
  const { token } = _getToken(req);
  if (!token) return authorizationFail(res);

  jwt.verify(token, config.authSecret, (err, user) => {
    if (err || !user) {
      req.user = undefined;
      return authorizationFail(res);
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

function _getUser({ token, deviceId }) {
  if (!token) return _createAnonymousUser({ deviceId });
  if (!deviceId) return Promise.reject();
  return _getUserByToken({ token, deviceId });
}

function _createAnonymousUser({ deviceId }) {
  return _getDefaultCurrencies()
    .then(currencies => {
      const user = new UserModel({
        type: 'anonymous',
        settings: { currencies },
        devices: [{ deviceId }],
      });
      return user.save().then(user => user);
    });
}

function _getUserByToken({ token, deviceId }) {
  return new Promise((resolve, reject) => {
    jwt.verify(token, config.authSecret, (err, decoded) => {
      if (err || !decoded) return reject(err);
      UserModel.findOne({ _id: decoded._id })
        .then(user => {
          if (!user) return _createAnonymousUser({ deviceId }).then(resolve);
          _userDeviceUpdate({ user, deviceId });
          return resolve(user);
        });
    });
  });
}

function _userDeviceUpdate({ user, deviceId }) {
  if (!user.devices || !user.devices.length) {
    user.devices = [{ deviceId }];
    user.save();
  } else {
    let isDeviceRegistered = false;
    user.devices.forEach(device => {
      if (device.deviceId === deviceId) isDeviceRegistered = true;
    });
    if (!isDeviceRegistered) {
      user.devices = [{ deviceId }];
      user.save();
    }
  }
}

function _getToken(req) {
  const authHeader = req.header('Authorization');
  if (req.query.deviceId) return { deviceId: req.query.deviceId };
  if (!authHeader || authHeader.indexOf(config.appName) === -1) return '';

  const authParams = authHeader.split(' ');
  if (authParams.length > 1) {
    const token = authParams[1] ? authParams[1].split('=')[1] : '';
    const deviceId = authParams[2] ? authParams[2].split('=')[1] : '';
    return { token, deviceId };
  }
  return '';
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
      MarketModel.findOne({ symbol: 'BTC' }, '_id symbol imageUrl name'),
      CurrencyModel.findOne({ code: 'USD' }, '_id code symbol decimalDigits'),
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

function authorizationFail(res) {
  return res.send({
    success: false,
    result: {
      message: 'Authorization fail',
    },
  });
}

module.exports = {
  getToken,
  getUser,
  checkAuth
};
