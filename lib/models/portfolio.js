const mongoose = require('mongoose');
const { ObjectId } = mongoose.Schema.Types;

const portfolioSchema = new mongoose.Schema({
  title: { type: String, required: true },
  owner: { type: ObjectId, ref: 'User', required: true },
  coins: [{ type: ObjectId, ref: 'Coin' }],
  inTotal: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  lastUpdated: { type: Date, default: Date.now },
  created: { type: Date, default: Date.now },
});

portfolioSchema.pre('save', function(next) {
  this.lastUpdated = Date.now();
  next();
});

module.exports = mongoose.model('Portfolio', portfolioSchema);
