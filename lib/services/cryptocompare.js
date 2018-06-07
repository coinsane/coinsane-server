const config = require('../../config');
const { getCached, setCached } = require('./cached');

const rp = require('request-promise-native');
const Bottleneck = require('bottleneck');
const limiter = new Bottleneck(config.cryptocompare.limiter.price);
const fetchLimit = limiter.wrap(rp);

function price(fsym, tsyms, options) {
  options = options || {};
  const uri = options.ts ?
    `${config.cryptocompare.apiMinUri}/data/pricehistorical` :
    `${config.cryptocompare.apiMinUri}/data/price`;
  let qs = { fsym, tsyms };
  if (options.exchanges) qs.e = options.exchanges;
  if (options.ts) qs.ts = options.ts;
  if (options.tryConversion === false) qs.tryConversion = false;
  const cacheKey = `services:cryptocompare:price:${JSON.stringify(qs)}`;
  options.nocache = true;
  return getCached(cacheKey, options.nocache)
    .then(cached => {
      if (cached.data) return cached;
      return fetchLimit({ uri, qs, json: true })
        .then(data => {
          if (!data) return {};
          const response = options.ts ? data[fsym] : data;
          setCached(cacheKey, response, config.cacheTime.price);
          return { data: response };
        })
        .catch(data => {
          return {};
        });
    });
}

function pricefull(fsyms, tsyms, options) {
  options = options || {};
  const uri = `${config.cryptocompare.apiMinUri}/data/pricemultifull`;
  let qs = { fsyms, tsyms };
  if (options.exchanges) qs.e = options.exchanges;
  if (options.tryConversion === false) qs.tryConversion = false;
  const cacheKey = `services:cryptocompare:pricefull:${JSON.stringify(qs)}`;
  return getCached(cacheKey, options.nocache)
    .then(cached => {
      if (cached.data) return cached;
      return fetchLimit({ uri, qs, json: true })
        .then(res => {
          const data = {};
          if (!(res && res.RAW)) return data;
          data.from = fsyms;
          data.to = tsyms;
          const price = res.RAW[fsyms][tsyms];
          if (price) {
            if (price.PRICE) data.price = price.PRICE;
            if (price.LASTUPDATE) data.lastUpdate = price.LASTUPDATE;
            if (price.LASTVOLUME) data.lastVolume = price.LASTVOLUME;
            if (price.LASTVOLUMETO) data.lastVolumeTo = price.LASTVOLUMETO;
            if (price.VOLUMEDAY) data.volumeDay = price.VOLUMEDAY;
            if (price.VOLUMEDAYTO) data.volumeDayTo = price.VOLUMEDAYTO;
            if (price.VOLUME24HOUR) data.volume24H = price.VOLUME24HOUR;
            if (price.VOLUME24HOURTO) data.volume24HTo = price.VOLUME24HOURTO;
            if (price.OPENDAY) data.openDay = price.OPENDAY;
            if (price.HIGHDAY) data.highDay = price.HIGHDAY;
            if (price.LOWDAY) data.lowDay = price.LOWDAY;
            if (price.OPEN24HOUR) data.open24H = price.OPEN24HOUR;
            if (price.HIGH24HOUR) data.high24H = price.HIGH24HOUR;
            if (price.LOW24HOUR) data.low24H = price.LOW24HOUR;
            if (price.CHANGE24HOUR) data.change24H = price.CHANGE24HOUR;
            if (price.CHANGEPCT24HOUR) data.changePct24H = price.CHANGEPCT24HOUR;
            if (price.CHANGEDAY) data.changeDay = price.CHANGEDAY;
            if (price.CHANGEPCTDAY) data.changePctDay = price.CHANGEPCTDAY;
            if (price.SUPPLY) data.supply = price.SUPPLY;
            if (price.MKTCAP) data.marketCap = price.MKTCAP;
            if (price.TOTALVOLUME24H) data.totalVolume24H = price.TOTALVOLUME24H;
            if (price.TOTALVOLUME24HTO) data.totalVolume24HTo = price.TOTALVOLUME24HTO;
          }
          setCached(cacheKey, data, config.cacheTime.price);
          return { data };
        })
        .catch(data => {
          return {};
        });
    });
}

function pricehisto(fsym, tsyms, ts, options) {
  options = options || {};
  ts = parseInt(ts / 1000);
  const uri = `${config.cryptocompare.apiMinUri}/data/pricehistorical`;
  let qs = { fsym, tsyms, ts };
  if (options.exchanges) qs.markets = options.exchanges;
  if (options.extraParams) qs.extraParams = options.extraParams;
  if (options.tryConversion === false) qs.tryConversion = false;
  const cacheKey = `services:cryptocompare:pricehisto:${JSON.stringify(qs)}`;
  return getCached(cacheKey, options.nocache)
    .then(cached => {
      if (cached.data) return cached;
      return fetchLimit({ uri, qs, json: true })
    })
    .catch(data => {
      return {};
    });
}

function topPairs(fsym, tsym, options) {
  options = options || {};
  const uri = `${config.cryptonator.apiUri}/full/${fsym}-${tsym}`;
  const cacheKey = `services:cryptonator:full:${fsym}-${tsym}`;
  return getCached(cacheKey, options.nocache)
    .then(cached => {
      if (cached.data) return { markets: cached.data };
      return fetchLimit({ uri, json: true })
        .then(res => {
          if (!(res && res.ticker)) return { markets: [] };
          const { markets } = res.ticker;
          setCached(cacheKey, markets, config.cacheTime.price);
          return { markets };
        })
    })
    .catch(data => {
      return {};
    });
}

module.exports = {
  price,
  pricefull,
  pricehisto,
  topPairs,
};
