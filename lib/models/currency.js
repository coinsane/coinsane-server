const mongoose = require('mongoose');

const currencySchema = new mongoose.Schema({
  symbol: String,
  name: String,
  symbolNative: String,
  decimalDigits: Number,
  rounding: Number,
  code: String,
  namePlural: String,
  prices: {
    BTC: {
      change24H: Number,
      changeDay: Number,
      changePct24H: Number,
      changePctDay: Number,
      high24H: Number,
      highDay: Number,
      lastUpdate: Number,
      low24H: Number,
      lowDay: Number,
      open24H: Number,
      openDay: Number,
      price: Number,
      totalVolume24H: Number,
      totalVolume24HTo: Number,
      volume24H: Number,
      volume24HTo: Number
    },
  },
  lastUpdated: { type: Date, default: Date.now },
  created: { type: Date, default: Date.now },
});

currencySchema.pre('save', function(next) {
  this.lastUpdated = Date.now();
  next();
});

module.exports = mongoose.model('Currency', currencySchema);
