# Coinsane

Coinsane app server & workers.

## Setup

- Set variables of your environment in `.env` file (example `.env.default`).
- Install dependencies with `yarn`.
- Start development server with `yarn dev`.

## API endpoints

- /totals
- /histo
- /limits

## Workers

- fetchCoins (executes daily)
- fetchPrices (every minute)
- updateTotals (every minute)
- updateExchanges (every minute)
