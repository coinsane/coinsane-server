const mongoose = require('mongoose');
const { ObjectId } = mongoose.Schema.Types;

const categorySchema = new mongoose.Schema({
  title: { type: String, required: true },
  owner: { type: ObjectId, ref: 'User' },
  system: { type: Boolean },
  lastUpdated: { type: Date, default: Date.now },
  created: { type: Date, default: Date.now },
});

categorySchema.pre('save', function(next) {
  this.lastUpdated = Date.now();
  next();
});

module.exports = mongoose.model('Category', categorySchema);
