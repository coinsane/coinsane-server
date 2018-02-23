const mongoose = require('mongoose');

const coinSchema = new mongoose.Schema({
  id: String,
  name: String,
  symbol: String,
  order: Number,
  imageUrl: String,
  algorithm: String,
  proofType: String,
  totalCoinSupply: String,
});

module.exports = mongoose.model('Coin', coinSchema);
