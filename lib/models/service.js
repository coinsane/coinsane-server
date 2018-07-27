const mongoose = require('mongoose');
const { ObjectId } = mongoose.Schema.Types;

const serviceSchema = new mongoose.Schema({
  owner: { type: ObjectId, ref: 'User', required: true },
  provider: { type: ObjectId, ref: 'Provider', required: true },
  key: { type: String },
  secret: { type: String },
  isActive: { type: Boolean, default: true },
  lastUpdated: { type: Date, default: Date.now },
  created: { type: Date, default: Date.now },
});

serviceSchema.pre('save', function(next) {
  this.lastUpdated = Date.now();
  next();
});

module.exports = mongoose.model('Service', serviceSchema);
