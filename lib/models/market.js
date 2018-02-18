module.exports = (mongoose) => {
  const marketSchema = new mongoose.Schema({
    id: String,
    imageUrl: String,
    name: String,
    order: Number,
    symbol: String,
    prices: {
      BTC: {
        change24H: Number,
        changeDay: Number,
        changePct24H: Number,
        changePctDay: Number,
        high24H: Number,
        highDay: Number,
        lastUpdate: Number,
        low24H: Number,
        lowDay: Number,
        open24H: Number,
        openDay: Number,
        price: Number,
        totalVolume24H: Number,
        totalVolume24HTo: Number,
        volume24H: Number,
        volume24HTo: Number
      }
    }
  });

  return mongoose.model('Market', marketSchema);
}
