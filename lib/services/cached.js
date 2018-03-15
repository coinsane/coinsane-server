const config = require('../../config');

const redis = require('redis');
const redisCache = redis.createClient(config.redis);
const { promisify } = require('util');
const cacheGet = promisify(redisCache.get).bind(redisCache);
const cacheSet = promisify(redisCache.set).bind(redisCache);

function getCached(key, nocache) {
  return new Promise(resolve => {
    let response = {};
    if (!key || nocache) return resolve(response);
      console.log('getCached1', response)
    const cachedKey = `[${config.env}]${key}`;
    cacheGet(cachedKey)
      .then(data => {
        console.log('getCached2', key, data)
        if (data) {
          try {
            response.cached = true;
            response.data = JSON.parse(data);
          } catch (e) {}
        }
        resolve(response);
      })
      .catch(() => resolve(response));
  });
}

function setCached(key, valueObj, time) {
  return new Promise(resolve => {
    let response = {};
    if (!(key && valueObj)) return resolve(response);
    const cachedKey = `[${config.env}]${key}`;
    const expired = time ? 'EX' : undefined;
    cacheSet(cachedKey, JSON.stringify(valueObj), expired, time)
      .then(() => {
        response.success = true;
        resolve(response);
      })
      .catch(() => resolve(response));
  });
}

module.exports = {
  getCached,
  setCached,
};
