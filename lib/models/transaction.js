const mongoose = require('mongoose');
const { ObjectId } = mongoose.Schema.Types;

const transactionSchema = new mongoose.Schema({
  owner: { type: ObjectId, ref: 'User', required: true },
  coin: { type: ObjectId, ref: 'Coin', required: true },
  date: { type: Date, default: Date.now },
  buy: { type: Boolean, default: true },
  amount: { type: Number, required: true },
  total: { type: Number, required: true },
  currency: { type: ObjectId, ref: 'Currency' },
  market: { type: ObjectId, ref: 'Market' },
  category: { type: ObjectId, ref: 'Category' },
  note: { type: String },
  histo: {},
  isActive: { type: Boolean, default: true },
  lastUpdated: { type: Date, default: Date.now },
  created: { type: Date, default: Date.now },
});

transactionSchema.pre('save', function(next) {
  this.lastUpdated = Date.now();
  next();
});

module.exports = mongoose.model('Transaction', transactionSchema);
