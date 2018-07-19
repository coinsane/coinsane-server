const mongoose = require('mongoose');
const { ObjectId } = mongoose.Schema.Types;

const userSchema = new mongoose.Schema({
  type: { type: String, enum: ['anonymous', 'user'] },
  email: String,
  devices: [{
    deviceId: { type: String },
    isActive: { type: Boolean, default: true },
  }],
  settings: {
    currencies: [{
      currency: { type: ObjectId, ref: 'Currency' },
      market: { type: ObjectId, ref: 'Market' },
      system: { type: Boolean, default: false },
    }],
  },
  isActive: { type: Boolean, default: true },
  lastUpdated: { type: Date, default: Date.now },
  created: { type: Date, default: Date.now },
});

userSchema.pre('save', function(next) {
  this.lastUpdated = Date.now();
  next();
});

module.exports = mongoose.model('User', userSchema);
