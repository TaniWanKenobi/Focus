require("dotenv").config();

const { App } = require("@slack/bolt");
const cron = require("node-cron");

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN,
});

// In-memory store — swap for Redis/DB in production
// { userId: { endTime: Date, reminder: string, messageCount: number, startTime: Date } }
const focusSessions = new Map();

const DEFAULT_DURATION_MINUTES = 25;
const DEFAULT_REMINDER =
  "Get back to work you bum";

// ─── Commands ────────────────────────────────────────────────────────────────

app.command("/focus", async ({ command, ack, respond, client }) => {
  await ack();

  const [subcommand, ...args] = command.text.trim().split(/\s+/);
  const userId = command.user_id;

  switch (subcommand) {
    case "start": {
      const minutes = parseInt(args[0]) || DEFAULT_DURATION_MINUTES;
      const reminder = args.slice(args[0] && !isNaN(args[0]) ? 1 : 0).join(" ") || DEFAULT_REMINDER;

      const endTime = new Date(Date.now() + minutes * 60 * 1000);
      focusSessions.set(userId, {
        startTime: new Date(),
        endTime,
        reminder,
        messageCount: 0,
        channelId: command.channel_id,
      });

      await respond({
        response_type: "ephemeral",
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*🔕 Focus mode ON* for ${minutes} minute${minutes !== 1 ? "s" : ""}.\nEvery message you send will get a gentle (or not so gentle) reminder.\n\nType \`/focus stop\` when you're done.`,
            },
          },
          {
            type: "context",
            elements: [
              {
                type: "mrkdwn",
                text: `Reminder: _"${reminder}"_`,
              },
            ],
          },
        ],
      });
      break;
    }

    case "stop": {
      const session = focusSessions.get(userId);
      if (!session) {
        await respond({ response_type: "ephemeral", text: "You don't have an active focus session." });
        return;
      }

      const elapsed = Math.round((Date.now() - session.startTime) / 60000);
      focusSessions.delete(userId);

      await respond({
        response_type: "ephemeral",
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*✅ Focus session ended.*\nDuration: ${elapsed} min | Messages sent during focus: ${session.messageCount}`,
            },
          },
        ],
      });
      break;
    }

    case "status": {
      const session = focusSessions.get(userId);
      if (!session) {
        await respond({ response_type: "ephemeral", text: "No active focus session. Start one with `/focus start`." });
        return;
      }

      const remaining = Math.max(0, Math.round((session.endTime - Date.now()) / 60000));
      await respond({
        response_type: "ephemeral",
        text: `🔕 Focus active — *${remaining} min* remaining. Messages sent: ${session.messageCount}.`,
      });
      break;
    }

    case "set": {
      // /focus set reminder <custom text>
      // /focus set duration <minutes>
      const [field, ...rest] = args;
      const session = focusSessions.get(userId);

      if (!session) {
        await respond({ response_type: "ephemeral", text: "Start a focus session first with `/focus start`." });
        return;
      }

      if (field === "reminder") {
        session.reminder = rest.join(" ");
        await respond({ response_type: "ephemeral", text: `Reminder updated to: _"${session.reminder}"_` });
      } else if (field === "duration") {
        const minutes = parseInt(rest[0]);
        if (!minutes || isNaN(minutes)) {
          await respond({ response_type: "ephemeral", text: "Usage: `/focus set duration <minutes>`" });
          return;
        }
        session.endTime = new Date(session.startTime.getTime() + minutes * 60 * 1000);
        await respond({ response_type: "ephemeral", text: `Session extended to ${minutes} minutes total.` });
      } else {
        await respond({
          response_type: "ephemeral",
          text: "Usage: `/focus set reminder <text>` or `/focus set duration <minutes>`",
        });
      }
      break;
    }

    default: {
      await respond({
        response_type: "ephemeral",
        text: [
          "*Focus Bot commands:*",
          "`/focus start [minutes] [reminder text]` — start a session (default: 25 min)",
          "`/focus stop` — end your session",
          "`/focus status` — check time remaining",
          "`/focus set reminder <text>` — change your reminder mid-session",
          "`/focus set duration <minutes>` — extend/shorten current session",
        ].join("\n"),
      });
    }
  }
});

// ─── Join user's public channels ──────────────────────────────────────────────

async function joinUserChannels(userId) {
  let cursor;
  do {
    const result = await app.client.users.conversations({
      user: userId,
      types: "public_channel",
      exclude_archived: true,
      limit: 200,
      cursor,
    });
    for (const channel of result.channels) {
      if (!channel.is_member) {
        try {
          await app.client.conversations.join({ channel: channel.id });
        } catch (_) {}
      }
    }
    cursor = result.response_metadata?.next_cursor;
  } while (cursor);
}

// ─── Message listener ─────────────────────────────────────────────────────────

app.event("message", async ({ event, client }) => {
  // Ignore bots, edits, deletes, thread replies (optional — remove last condition to catch those too)
  if (
    event.subtype ||
    event.bot_id ||
    !event.user
  ) return;

  const session = focusSessions.get(event.user);
  if (!session) return;

  // Session expired?
  if (Date.now() > session.endTime) {
    focusSessions.delete(event.user);
    await client.chat.postEphemeral({
      channel: event.channel,
      user: event.user,
      text: "⏰ Your focus session ended. Hope you got stuff done!",
    });
    return;
  }

  session.messageCount++;

  try {
    await client.conversations.join({ channel: event.channel });
  } catch (_) {}

  await client.chat.postMessage({
    channel: event.channel,
    thread_ts: event.ts,
    text: `<@${event.user}> ${session.reminder}`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: session.reminder,
        },
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `🔕 Focus mode active · ${Math.max(0, Math.round((session.endTime - Date.now()) / 60000))} min left · \`/focus stop\` to end`,
          },
        ],
      },
    ],
  });
});

// ─── Auto-expire cron (checks every minute) ───────────────────────────────────

cron.schedule("* * * * *", async () => {
  const now = Date.now();
  for (const [userId, session] of focusSessions.entries()) {
    if (now > session.endTime) {
      focusSessions.delete(userId);
      try {
        await app.client.chat.postEphemeral({
          channel: session.channelId,
          user: userId,
          text: "⏰ Your focus session is over. Hope it was productive!",
        });
      } catch (_) {}
    }
  }
});

// ─── Start ────────────────────────────────────────────────────────────────────

(async () => {
  await app.start();
  console.log("⚡ Focus bot running");

})();
