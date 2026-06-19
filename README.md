# Hooked 🎣

A simple browser fishing game where players **cast, catch fish, earn $HOOKED, and upgrade gear** — built for your Solana token launch.

## Play locally

```bash
# From the Hooked folder — any static file server works
npx serve .
```

Then open the URL shown (usually `http://localhost:3000`).

Or with Python:

```bash
python -m http.server 8080
```

## How to play

1. **Click the water** to cast your line.
2. Wait for a bite — when you see **FISH ON!**, hit **REEL IT IN!**
3. During the reel mini-game, **hold Space or click & hold** to keep the gold marker in the green zone.
4. Earn **$HOOKED** for every catch.
5. Spend tokens in the **Gear Shop** to upgrade your Rod, Line, and Bait.

## Connect your wallet

- Click **Connect Wallet** to link a **Phantom** wallet.
- Progress (balance, gear, catches) saves per wallet address in local storage.
- Guest play works without a wallet.

## Start Hooked (game + auto rewards)

Double-click **`start.bat`** or run:

```bash
npm start
```

This starts **one server** at [http://localhost:3001](http://localhost:3001) that serves:
- The fishing game
- The rewards API

The server **watches Solana** for your token mint. The moment it goes live on-chain, rewards flip on automatically — no manual step needed.

## $HOOKED token

Mint: `98YegoUGDT9nh4yykhH7qzGYhM9AG6Ztjn5UMrYjpump`  
Treasury: `7bw6Jx8AycbgZvmKJaB9pMhpUSUtfDf8GAPChUfM1Ha9`

## Treasury setup

1. Copy `server/.env.example` → `server/.env`
2. Set `TREASURY_PRIVATE_KEY` (never commit `.env`)
3. Treasury needs **$HOOKED** + a little **SOL** for fees

## How rewards work

1. Start Hooked (`start.bat` or `npm start`)
2. Server polls Solana every 5s until mint is live
3. Connect Phantom and catch fish — $HOOKED sends automatically

## Project structure

```
Hooked/
├── index.html      # Game page
├── css/style.css   # Styling
├── js/
│   ├── config.js   # Token + fish + upgrade config
│   ├── main.js     # App bootstrap
│   ├── game.js     # Canvas fishing mechanics
│   ├── fish.js     # Fish spawning logic
│   ├── player.js   # Balance + upgrades
│   ├── shop.js     # Shop UI
│   ├── storage.js  # Save/load per wallet
│   └── wallet.js   # Phantom + Solana integration
└── README.md
```

## Customize

- **Fish & rewards** — edit the `fish` array in `js/config.js`
- **Upgrade costs & effects** — edit the `upgrades` object in `js/config.js`
- **Branding** — update `index.html` and `css/style.css`

---

Cast a line. Catch fish. Get Hooked.
