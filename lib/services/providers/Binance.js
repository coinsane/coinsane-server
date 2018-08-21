
class Binance {
  constructor(options) {
    const { key, secret } = options;
    this.api = require('node-binance-api')().options({
      APIKEY: key,
      APISECRET: secret,
      useServerTime: true,
    });
  }

  getBalances() {
    return new Promise((resolve, reject) => {
      this.api.balance((error, data) => {
        if (error) return reject('Data is unreachable');
        const result = Object.keys(data).map(key => {
          let symbol = key;
          if (key === 'BCC') symbol = 'BCH';
          return { symbol, amount: parseFloat(data[key].available) }
        });
        resolve(result);
      });
    });
  }

}

module.exports = Binance;
