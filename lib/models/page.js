const mongoose = require('mongoose');

const pageSchema = new mongoose.Schema({
  name: { type: String, required: true },
  title: { type: String },
  content: { type: String },
  locale: { type: String, default: 'en' },
  lastUpdated: { type: Date, default: Date.now },
  created: { type: Date, default: Date.now },
});

pageSchema.pre('save', function(next) {
  this.lastUpdated = Date.now();
  next();
});

module.exports = mongoose.model('Page', pageSchema);
