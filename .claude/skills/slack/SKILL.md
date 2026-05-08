---
name: slack
description: Set up the Slack MCP server for the loyalty-app monorepo end-to-end — create the Slack app, pick scopes, install it, copy the bot token, find the team ID, invite the bot to channels, and wire env vars. Use when adding a new Slack workspace, rotating tokens, debugging "not_in_channel" or "missing_scope" errors, or onboarding a teammate.
---

# Slack MCP — operations cookbook

Slack MCP lets Claude Code post messages, list channels, read history, and add reactions from inside the editor. Drives the Better Stack alert pipeline (incidents post to `#alerts-loyalty`) and lets us paste smoke-test confirmations / status-update threads from automation.

The MCP is the **stdio** server `@modelcontextprotocol/server-slack`, registered in `.mcp.json` like this:

```json
"slack": {
  "type": "stdio",
  "command": "node_modules/.bin/dotenv",
  "args": ["-e", ".env", "--", "npx", "-y", "@modelcontextprotocol/server-slack"]
}
```

`dotenv-cli` injects `SLACK_BOT_TOKEN` and `SLACK_TEAM_ID` from the project `.env` at handshake time, so contributors don't need shell exports.

---

## One-time setup (per workspace)

### 1. Create the Slack app

1. Open https://api.slack.com/apps → **Create New App** → **From scratch**.
2. Name: `loyalty-app-dev` (use anything; only visible inside Slack admin).
3. Select your workspace. Click **Create App**.

### 2. Configure bot scopes

Sidebar → **OAuth & Permissions** → scroll to **Scopes** → **Bot Token Scopes** → **Add an OAuth Scope** and add:

| Scope | Why |
| --- | --- |
| `chat:write` | post messages |
| `channels:history` | read public-channel history (needed to compute thread replies) |
| `channels:read` | list public channels (so the MCP can resolve names → IDs) |
| `groups:read` | list private channels the bot is invited to |
| `reactions:write` | add ✅/❌ reactions to messages |
| `users:read` | resolve user IDs ↔ names |

> Don't add `chat:write.public` (would let the bot post to channels it's not a member of — security smell).
> Don't add `app_mentions:read` unless you plan to listen for mentions.

### 3. Install to workspace

Same page → **Install to Workspace** → review the scopes → **Allow**. Slack admin approval may be needed if your workspace requires it.

After install you land back on **OAuth & Permissions**. Copy the **Bot User OAuth Token** that starts with `xoxb-…`. That's the `SLACK_BOT_TOKEN`.

### 4. Find the team ID

Two ways:

- Open Slack in a browser. The URL is `https://app.slack.com/client/T01234567/...` — the `T01234567` is your team ID.
- Run https://api.slack.com/methods/team.info/test (signed in) → `team.id` field.

### 5. Wire the env vars

Add to your local `.env`:

```
SLACK_BOT_TOKEN=xoxb-...
SLACK_TEAM_ID=T01234567
```

Restart Claude Code (the MCP only reads on handshake). `/mcp` should now show `slack: connected`.

### 6. Invite the bot to the channels you care about

The bot can only post to channels it is a member of. For each channel you want to use:

1. Open the channel in Slack.
2. `/invite @loyalty-app-dev` (or whatever you named the app).
3. Or: channel ⚙️ → **Integrations** → **Add an App** → select the bot.

If you skip this step, posts return `{"error":"not_in_channel"}`.

---

## Day-to-day operations

### Discover (always run before any action)

```
ToolSearch select:mcp__slack__slack_list_channels,mcp__slack__slack_get_channel_history,mcp__slack__slack_post_message,mcp__slack__slack_reply_to_thread,mcp__slack__slack_add_reaction,mcp__slack__slack_get_thread_replies,mcp__slack__slack_get_users,mcp__slack__slack_get_user_profile
```

### Common operations

| Goal | Tool | Notes |
| --- | --- | --- |
| Resolve channel name → id | `slack_list_channels` | Cache the id; channel names rarely change. |
| Post a message | `slack_post_message` | `channel_id` is the C-prefixed id, not the name. Markdown supported via `*bold*`, `` `code` ``, `<https://x|label>`. |
| Reply in thread | `slack_reply_to_thread` | Pass `thread_ts` from the parent message. |
| Read recent activity | `slack_get_channel_history` | Default returns last 10. Use `oldest`/`latest` epoch for ranges. |
| React to a message | `slack_add_reaction` | Use Slack's emoji codes (`white_check_mark`, `eyes`, etc.). |

### Repo conventions

- **Naming**: alert-style channels `#alerts-<area>` (`#alerts-loyalty`, `#alerts-payments` later). Discussion in `#all-loyalty-app` or thematic channels (`#dev`, `#owner`).
- **Bot membership**: the bot is invited only to the channels where it needs to post. Default is `#alerts-loyalty`. Don't add to `#general` unless explicitly wanted.
- **Message style**: emoji at the start tags severity (`:white_check_mark:` ok, `:warning:` heads-up, `:rotating_light:` incident). Code-fence tokens with backticks. Sign messages with `— from <source>` so humans can trace them back.

### Posting from Claude Code

```
slack_list_channels → grab id of #alerts-loyalty
slack_post_message channel_id="C0..." text=":white_check_mark: deploy ok"
```

### Posting from CI / scripts (alternative to MCP)

If a non-Claude script needs to post, prefer **incoming webhooks** (separate from the MCP):

1. https://api.slack.com/apps → your app → **Incoming Webhooks** → activate.
2. Add a webhook for the destination channel → copy the URL.
3. Save it as `SLACK_WEBHOOK_URL` in the deploy env.
4. POST JSON `{"text": "..."}` to that URL.

Webhook requires no scopes and no `not_in_channel` worry; downside is one URL per channel and no thread support.

---

## Troubleshooting

### `not_in_channel` when posting

The bot isn't a member of that channel. `/invite @<bot>` from inside Slack. Affects private channels (`groups:read` scope) and public channels alike.

### `missing_scope`

You added the scope after installing the app, so the existing token doesn't have it.

1. **OAuth & Permissions** → add the scope.
2. Click **Reinstall to Workspace** at the top.
3. Copy the **new** Bot Token (the old one stays valid but doesn't gain scopes retroactively — Slack issues a new token).
4. Update `SLACK_BOT_TOKEN` in `.env` and restart Claude Code.

### `invalid_auth`

Token typo or rotated. Regenerate at OAuth & Permissions → **Reinstall**, then update `.env`.

### MCP shows "stdio failed to start"

The wrapper command `node_modules/.bin/dotenv -e .env -- npx -y @modelcontextprotocol/server-slack` failed. Common causes:

- `.env` missing → run `cp .env.example .env` and fill in.
- `node_modules/.bin/dotenv` missing → `bun install` at the repo root.
- `npx -y @modelcontextprotocol/server-slack` failing → likely a temp registry issue. Try again; if persistent, run the command in a terminal to see stderr.

### The bot posts but nobody sees it

You posted to the wrong channel. Always confirm `channel_id` came from `slack_list_channels` rather than guessing — the IDs are stable, names can change.

### `SLACK_TEAM_ID` mismatch

Symptom: tools work but only against an unexpected workspace. The token belongs to one workspace and `SLACK_TEAM_ID` to another. Both must come from the **same** Slack admin tab.

---

## Quick MCP tool cheat sheet

| Goal | Selector |
| --- | --- |
| List + post | `select:mcp__slack__slack_list_channels,mcp__slack__slack_post_message` |
| Threads | `select:mcp__slack__slack_post_message,mcp__slack__slack_reply_to_thread,mcp__slack__slack_get_thread_replies` |
| Read history | `select:mcp__slack__slack_get_channel_history,mcp__slack__slack_list_channels` |
| Reactions | `select:mcp__slack__slack_add_reaction` |
| Users | `select:mcp__slack__slack_get_users,mcp__slack__slack_get_user_profile` |

---

## Where to look first

- This skill: token, scopes, invites, troubleshooting.
- `.mcp.json` at repo root: how the server is wrapped with dotenv-cli.
- `.env.example` "MCP servers" section: the two vars to fill.
- `.claude/skills/better-stack/SKILL.md`: how Better Stack hooks Slack into the alert pipeline (incident → BS notification channel → Slack post).
