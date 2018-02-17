const config = require('../../config');
const rp = require('request-promise-native');

function apiLimits(req, res, next) {
  const limitsPromises = ['second', 'hour'].map(period => {
    const uri = `${config.apiUri}stats/rate/${period}/limit`;
    return rp({ uri, json: true });
  });

  Promise
    .all(limitsPromises)
    .then(data => res.send(data));
}

module.exports = apiLimits;
