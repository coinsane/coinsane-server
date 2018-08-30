const mongoose = require('mongoose');

const marketSchema = new mongoose.Schema({
  id: String,
  imageUrl: String,
  color: String,
  name: String,
  order: Number,
  rank: Number,
  symbol: String,
  algorithm: String,
  proofType: String,
  totalCoinSupply: String,
  prices: {},
  lastUpdated: { type: Date, default: Date.now },
  created: { type: Date, default: Date.now },
});

marketSchema.pre('save', function(next) {
  this.lastUpdated = Date.now();
  next();
});

module.exports = mongoose.model('Market', marketSchema);
