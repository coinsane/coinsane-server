
class Bittrex {
  constructor(options) {
    const { key, secret } = options;
    this.api = require('node.bittrex.api');
    this.api.options({
      apikey: key,
      apisecret: secret,
      stream: true,
      verbose: false,
      cleartext: false
    });
  }

  getBalances() {
    return new Promise((resolve, reject) => {
      this.api.getbalances(data => {
        if (data && data.success) {
          const result = data.result.map(({ Currency, Balance }) => ({ symbol: Currency, amount: parseFloat(Balance) }));
          resolve(result);
        }
        else reject('Data is unreachable')
      });
    });
  }

}

module.exports = Bittrex;
