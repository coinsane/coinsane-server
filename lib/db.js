const MarketModel = require('./models/market');
const CoinModel = require('./models/coin');
const TotalModel = require('./models/total');
const UserModel = require('./models/user');
const PortfolioModel = require('./models/portfolio');
const TransactionModel = require('./models/transaction');
const CategoryModel = require('./models/category');
const CurrencyModel = require('./models/currency');
const PageModel = require('./models/page');
const FiatModel = require('./models/fiat');

function db() {
  return {
    MarketModel,
    CoinModel,
    TotalModel,
    UserModel,
    PortfolioModel,
    TransactionModel,
    CategoryModel,
    CurrencyModel,
    PageModel,
    FiatModel,
  };
}

module.exports = { db };
