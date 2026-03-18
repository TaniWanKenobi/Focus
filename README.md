# Focus Bot

A Slack bot that publicly shames you when you message during a focus session. When you send a message, the bot replies in-thread tagging you with a reminder to get back to work — visible to everyone in the channel.

## How it works

1. Run `/focus start` to begin a focus session
2. Every message you send gets a public threaded reply tagging you with your reminder
3. The bot auto-joins any public channel you message in
4. Sessions auto-expire or end manually with `/focus stop`

---

## Setup

### 1. Create a Slack app

1. Go to [api.slack.com/apps](https://api.slack.com/apps) and click **Create New App → From manifest**
2. Paste the contents of `manifest.yml`
3. Install the app to your workspace

### 2. Required scopes

Under **OAuth & Permissions → Bot Token Scopes**:
- `chat:write` — post messages
- `channels:join` — auto-join public channels
- `channels:history` — read messages in public channels
- `channels:read` — list channels
- `groups:history` — read messages in private channels
- `groups:read` — list private channels
- `commands` — slash commands

Under **Event Subscriptions → Subscribe to events on behalf of users**:
- `message.channels` — receive messages from all public channels
- `message.groups` — receive messages from private channels the bot is in

### 3. Get your credentials

From the Slack app settings page, grab:
- **Bot Token** (`xoxb-...`) — under *OAuth & Permissions*
- **Signing Secret** — under *Basic Information*
- **App-Level Token** (`xapp-...`) — under *Basic Information → App-Level Tokens*, create one with `connections:write` scope

### 4. Configure environment

Create a `.env` file:

```
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_SIGNING_SECRET=your-signing-secret
SLACK_APP_TOKEN=xapp-your-app-token
```

### 5. Install and run

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

## Notes

- Reminders are **public threaded replies** that @mention the user — everyone in the channel can see them
- The bot auto-joins public channels when you message in them (no need to manually invite it)
- For private channels, invite the bot with `/invite @Focus Bot` — it can't auto-join those
- Sessions are stored in-memory — restarting the bot clears active sessions
- The bot needs Socket Mode enabled (uses WebSocket, no public URL required)
