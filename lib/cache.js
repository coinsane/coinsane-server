const config = require('../config');
const redis = require('redis');
const cache = redis.createClient(config.redis);
const { promisify } = require('util');
const cacheGetPromise = promisify(cache.get).bind(cache);

function getCacheKey(namespace, value) {
  return `${config.env}:${namespace}:${JSON.stringify(value)}`;
}

function cacheGet(key) {
  return cacheGetPromise(key);
}

function cacheSet(key, value, time) {
  return cache.set(key, JSON.stringify(value), 'PX', time);
}

module.exports = {
  getCacheKey,
  cacheGet,
  cacheSet,
};
