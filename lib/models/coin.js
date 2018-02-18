module.exports = (mongoose) => {
  const coinSchema = new mongoose.Schema({
    id: String,
    name: String,
    symbol: String,
    order: Number,
    imageUrl: String,
    algorithm: String,
    proofType: String,
    totalCoinSupply: String,
  });

  return mongoose.model('Coin', coinSchema);
}
