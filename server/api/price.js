const config = require('../../config');
const { price, pricefull } = require('../../lib/services/cryptocompare');

function getPrice(req, res, next) {
  const { fsym, tsyms, nocache } = req.query;

  if (!(fsym && tsyms)) {
    return res.send({
      success: false,
      data: 'These query params are required: fsym, tsyms'
    });
  }

  price(fsym, tsyms, { nocache })
    .then(data => res.send(data));
}

function getPriceFull(req, res, next) {
  const { fsym, tsyms, nocache } = req.query;

  if (!(fsym && tsyms)) {
    return res.send({
      success: false,
      data: 'These query params are required: fsym, tsyms'
    });
  }

  pricefull(fsym, tsyms, { nocache })
    .then(data => res.send(data));
}

module.exports = {
  getPrice,
  getPriceFull,
};
