const mongoose = require('mongoose');
const { ObjectId } = mongoose.Schema.Types;

const totalSchema = new mongoose.Schema({
  owner: { type: ObjectId, ref: 'User', required: true },
  portfolio: { type: ObjectId, ref: 'Portfolio', required: true },
  mins: [{
    time: { type: Number },
    value: { type: Number },
  }],
  hours: [{
    time: { type: Number },
    value: {
      min: { type: Number },
      max: { type: Number },
      avg: { type: Number },
    }
  }],
  days: [{
    time: { type: Number },
    value: {
      min: { type: Number },
      max: { type: Number },
      avg: { type: Number },
    }
  }],
  minsCount: { type: Number, default: 0 },
  hoursCount: { type: Number, default: 0 },
  daysCount: { type: Number, default: 0 },
  lastUpdated: { type: Date, default: Date.now },
  created: { type: Date, default: Date.now },
});

totalSchema.pre('save', function(next) {
  this.lastUpdated = Date.now();
  next();
});

module.exports = mongoose.model('Total', totalSchema);
