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
      price: Number,
      lastUpdate: Number,
      lastVolume: Number,
      lastVolumeTo: Number,
      volumeDay: Number,
      volumeDayTo: Number,
      volume24H: Number,
      volume24HTo: Number,
      openDay: Number,
      highDay: Number,
      lowDay: Number,
      open24H: Number,
      high24H: Number,
      low24H: Number,
      change24H: Number,
      changePct24H: Number,
      changeDay: Number,
      changePctDay: Number,
      supply: Number,
      marketCap: Number,
      totalVolume24H: Number,
      totalVolume24HTo: Number,
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
