const mongoose = require('mongoose');
const { ObjectId } = mongoose.Schema.Types;

const fiatSchema = new mongoose.Schema({
  currency: { type: ObjectId, ref: 'Currency', required: true },
  owner: { type: ObjectId, ref: 'User', required: true },
  transactions: [{ type: ObjectId, ref: 'Transaction' }],
  amount: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
  lastUpdated: { type: Date, default: Date.now },
  created: { type: Date, default: Date.now },
});

fiatSchema.pre('save', function(next) {
  this.lastUpdated = Date.now();
  next();
});

module.exports = mongoose.model('Fiat', fiatSchema);
