const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  type: String,
  username: String,
  ip: String,
  isActive: { type: Boolean, default: true },
  lastUpdated: { type: Date, default: Date.now },
  created: { type: Date, default: Date.now },
});

userSchema.pre('save', function(next) {
  this.lastUpdated = Date.now();
  next();
});

module.exports = mongoose.model('User', userSchema);
