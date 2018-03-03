const mongoose = require('mongoose');
const { ObjectId } = mongoose.Schema.Types;

const coinSchema = new mongoose.Schema({
  market: { type: ObjectId, ref: 'Market', required: true },
  owner: { type: ObjectId, ref: 'User', required: true },
  portfolio: { type: ObjectId, ref: 'Portfolio' },
  transactions: [{ type: ObjectId, ref: 'Transaction' }],
  amount: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
  lastUpdated: { type: Date, default: Date.now },
  created: { type: Date, default: Date.now },
});

coinSchema.pre('save', function(next) {
  this.lastUpdated = Date.now();
  next();
});

module.exports = mongoose.model('Coin', coinSchema);
