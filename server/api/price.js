const config = require('../../config');
const { price, pricefull } = require('../../lib/services/cryptocompare');

function getPrice(req, res, next) {
  const { fsym, tsyms, date, nocache } = req.query;

  if (!(fsym && tsyms)) {
    return res.send({
      success: false,
      data: 'These query params are required: fsym, tsyms'
    });
  }

  const options = { nocache };

  try {
    if (date) options.ts = parseInt(new Date(date).getTime()/1000);
  } catch(e) {}

  price(fsym, tsyms, options)
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
