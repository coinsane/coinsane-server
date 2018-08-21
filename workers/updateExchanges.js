const config = require('../config');
const { getCoins } = require('../lib/services/exchanges');
const { db } = require('../lib/db');

const { ServiceModel } = db();

module.exports = updateExchanges;

function updateExchanges() {
  const startTime = new Date();
  return Promise.resolve()
    .then(getAllServices)
    .then(services => {
      if (!services && !services.length) return {};
      const servicesPromises = []
      services.forEach((service) => {
        const { owner, portfolio, provider, key, secret } = service;
        servicesPromises.push(getCoins({ owner, portfolio, provider, key, secret }));
      });
      return Promise.all(servicesPromises);
    })
    .then(() => {
      console.log('updateExchanges', new Date(new Date() - startTime).getTime()/1000, 'sec' );
      return;
    });
}

function getAllServices() {
  return ServiceModel.find({
    isActive: true,
  }, 'owner portfolio provider key secret')
    .populate([
      {
        path: 'provider',
        model: 'Provider',
        select: 'name',
      },
      {
        path: 'portfolio',
        model: 'Portfolio',
        match: { isActive: true },
        populate: [
          {
            path: 'coins',
            model: 'Coin',
            match: { isActive: true },
            select: 'amount',
          }
        ],
      },
    ])
    .then(services => services);
}
