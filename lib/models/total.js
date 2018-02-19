const mongoose = require('mongoose');

const totalSchema = new mongoose.Schema({
  portfolioId: String,
  mins: [{
    time: Number,
    value: Number
  }],
  minsCount: Number,
  hours: [{
    time: Number,
    value: {
      min: Number,
      max: Number,
      avg: Number
    }
  }],
  hoursCount: Number,
  days: [{
    time: Number,
    value: {
      min: Number,
      max: Number,
      avg: Number
    }
  }],
  daysCount: Number,
});

module.exports = mongoose.model('Total', totalSchema);
