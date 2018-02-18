const mongoose = require('mongoose');

const totalSchema = new mongoose.Schema({
  portfolioId: String,
  mins: [{
    time: Number,
    value: Number
  }],
  hours: [{
    time: Number,
    value: {
      min: Number,
      max: Number,
      avg: Number
    }
  }],
  days: [{
    time: Number,
    value: {
      min: Number,
      max: Number,
      avg: Number
    }
  }],
});

module.exports = mongoose.model('Total', totalSchema);
