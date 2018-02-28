const jwt = require('jsonwebtoken');

const config = require('../../config');
const { mongo } = require('../../lib/db');
const { userModel } = mongo();

function getToken(req, res, next) {
  const token = _getToken(req);

  _getUser(token)
    .then(user => {
      return res.send({
        success: true,
        result: {
          token: jwt.sign({ _id: user._id, type: user.type }, config.authSecret)
        }
      })
    })
    .then(next)
    .catch(err => {
      res.send({
        success: false,
        result: {
          message: 'Authorization fail'
        }
      });
    });
}

function checkAuth(req, res, next) {
  const token = _getToken(req);
  if (!token) return res.send({
    success: false,
    result: {
      message: 'Authorization fail'
    }
  });

  jwt.verify(token, config.authSecret, (err, user) => {
    if (err || !user) {
      req.user = undefined;
      return res.send({
        success: false,
        result: {
          message: 'Authorization fail'
        }
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
      user: req.user
    }
  });
  next();
}

function _getUser(token) {
  if (!token) return _createAnonymousUser();
  return _getUserByToken(token);
}

function _createAnonymousUser() {
  const user = new userModel({ type: 'anonymous' });
  return user.save().then(user => user);
}

function _getUserByToken(token) {
  return new Promise((resolve, reject) => {
    jwt.verify(token, config.authSecret, (err, decoded) => {
      if (err || !decoded) return reject(err);
      userModel.findOne({ _id: decoded._id })
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

module.exports = {
  getToken,
  getUser,
  checkAuth
};
