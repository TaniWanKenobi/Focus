# Focus Bot

A Slack bot that reminds you to stop messaging and get back to work when you're in a focus session.

## How it works

Users run `/focus start` to begin a session. Every message they send while the session is active gets an ephemeral nudge — only they can see it, nobody else in the channel does. Sessions auto-expire. `/focus stop` ends it manually.

---

## Setup

### 1. Create a Slack app

1. Go to [api.slack.com/apps](https://api.slack.com/apps) and click **Create New App → From manifest**
2. Paste the contents of `manifest.yml`
3. Install the app to your workspace

### 2. Get your credentials

From the Slack app settings page, grab:
- **Bot Token** (`xoxb-...`) — under *OAuth & Permissions*
- **Signing Secret** — under *Basic Information*
- **App-Level Token** (`xapp-...`) — under *Basic Information → App-Level Tokens*, create one with `connections:write` scope

### 3. Configure environment

```bash
cp .env.example .env
# Fill in your three tokens
```

### 4. Install and run

```bash
npm install
npm start
```

For development with auto-reload:
```bash
npm run dev
```

---

## Commands

| Command | What it does |
|---|---|
| `/focus start` | Start a 25-min session with the default reminder |
| `/focus start 45` | Start a 45-min session |
| `/focus start 60 Stop slacking!` | Custom duration + custom reminder |
| `/focus stop` | End your current session |
| `/focus status` | Check time remaining |
| `/focus set reminder <text>` | Change reminder mid-session |
| `/focus set duration <minutes>` | Adjust duration mid-session |
| `/focus` | Show all commands |

---

## Deploying to production

The bot needs to stay running to listen for messages. Easy options:

- **Railway / Render / Fly.io** — push the repo, set env vars, done
- **PM2 on a VPS** — `pm2 start index.js --name focus-bot`

For production, swap the in-memory `focusSessions` Map for Redis so sessions survive restarts:

```js
// npm install ioredis
const Redis = require("ioredis");
const redis = new Redis(process.env.REDIS_URL);

// set: redis.set(`focus:${userId}`, JSON.stringify(session), "EX", ttlSeconds)
// get: JSON.parse(await redis.get(`focus:${userId}`))
// del: redis.del(`focus:${userId}`)
```

---

## Notes

- Ephemeral messages are only visible to the sender — no channel noise
- The bot needs to be in a channel to see messages there (invite it with `/invite @Focus Bot`)
- For DMs, it listens automatically
