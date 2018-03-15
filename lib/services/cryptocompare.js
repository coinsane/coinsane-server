const config = require('../../config');
const { getCached, setCached } = require('./cached');

const rp = require('request-promise-native');
const Bottleneck = require('bottleneck');
const limiter = new Bottleneck(config.cryptocompare.limiter.price);
const fetchLimit = limiter.wrap(rp);

function price(fsym, tsyms, options) {
  options = options || {}
  const uri = `${config.cryptocompare.apiMinUri}/data/price`;
  let qs = { fsym, tsyms };
  if (options.exchanges) qs.e = options.exchanges;
  if (options.tryConversion === false) qs.tryConversion = false;
  const cacheKey = `services:cryptocompare:price:${JSON.stringify(qs)}`;
  return getCached(cacheKey, options.nocache)
    .then(cached => {
      if (cached.data) return cached;
      return fetchLimit({ uri, qs, json: true })
        .then(data => {
          if (!data) return {};
          setCached(cacheKey, data, config.cacheTime.price);
          return { data };
        })
        .catch(data => {
          return {};
        });
    });
}

module.exports = {
  price,
};
