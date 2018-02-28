const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  type: String,
  username: String,
  ip: String,
});

module.exports = mongoose.model('User', userSchema);
