# World Weaver Chronicles

Dark-fantasy browser RPG (React + Zustand + Express + TypeScript) with Telegram Mini App support.

## Quick Start

### 1. Install

```bash
npm install
```

### 2. Configure env

Create `.env` from `.env.example` and fill:

- `DATABASE_URL` (PostgreSQL)
- `AUTH_SECRET` (long random string for session signing)
- `ADMIN_LOGIN` / `ADMIN_PASSWORD` (admin access credentials)
- `TELEGRAM_BOT_TOKEN` (from BotFather)
- `MINI_APP_URL` (public HTTPS URL of your app)

### 3. Run web app

```bash
npm run dev
```

App runs on `http://localhost:5000`.

### 4. Run Telegram bot

```bash
npm run bot
```

### 5. Windows one-click start

Use root script:

```bat
start-telegram-miniapp.bat
```

It opens 2 terminals: web server + Telegram bot.

## Database

The server uses Postgres when `DATABASE_URL` is set, otherwise falls back to in-memory storage.

Push schema:

```bash
npm run db:push
```

### Current DB tables

- `users`
- `game_saves` (`user_id`, JSON save payload, `updated_at`)

## Project Structure

- `client/` — React frontend
- `client/src/game/store.ts` — core game loop and state
- `client/src/components/game/` — game screens and panels
- `server/` — Express backend and Telegram bot
- `server/routes.ts` — REST API routes
- `server/telegram-bot.ts` — Telegram bot entrypoint
- `shared/game-content.ts` — shared game content (locations, enemies, quests, items)
- `shared/game-types.ts` — shared game domain types
- `shared/schema.ts` — Drizzle schema

## API (first migration step)

- `GET /api/health`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/logout`
- `GET /api/game/content` — shared game content from backend
- `GET /api/game/save` — load save for authenticated session
- `PUT /api/game/save` — upsert save for authenticated session
- `DELETE /api/game/save` — delete save for authenticated session

## Telegram Mini App Setup

1. Create bot in BotFather.
2. Host app on public HTTPS URL (for local dev: ngrok/cloudflared).
3. Set `MINI_APP_URL` to this URL.
4. Run `npm run bot`.
5. Send `/start` to bot and open the `Play` web app button.

Client auto-initializes Telegram WebApp SDK in:

- `client/index.html`
- `client/src/lib/telegram.ts`

When opened inside Telegram, game save is synced to backend through authenticated session cookie.

## Where to Change Content

Main gameplay content is centralized in `shared/game-content.ts`:

- `WEATHER`
- `SKILLS`
- `RECIPES`
- `ITEMS`
- `ENEMIES`
- `LOCATIONS`
- `INITIAL_QUESTS`
- `NPCS`
- `MERCHANTS`
- `ALL_QUESTS`

After editing content, restart dev server if needed.

## Quality Checks

```bash
npm run check
npm run test
npm run audio:check
```

Fix audio manifest automatically:

```bash
npm run audio:fix
```

## Notes

- `client/src/game/constants.ts` and `client/src/game/types.ts` now re-export from `shared/*`.
- This is the first migration step: content and saves moved to API/DB boundary; gameplay logic remains in client store.
