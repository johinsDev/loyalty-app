#!/usr/bin/env bash
# Post a prod-deploy summary to Slack. Called by deploy-prod.yml as the final
# step (always(), so it also reports failures). Reads SLACK_DEPLOY_WEBHOOK_URL
# from the Infisical-injected env (prod /ci) — a NO-OP when it's unset, so the
# deploy never fails just because Slack isn't wired yet.
#
# To enable: create a Slack Incoming Webhook for the deploys channel
# (api.slack.com/messaging/webhooks) and store the URL in Infisical prod /ci:
#   infisical secrets set SLACK_DEPLOY_WEBHOOK_URL="https://hooks.slack.com/services/..." --env=prod --path=/ci
set -euo pipefail

URL="${SLACK_DEPLOY_WEBHOOK_URL:-}"
if [ -z "$URL" ]; then
  echo "SLACK_DEPLOY_WEBHOOK_URL not set — skipping Slack notification"
  exit 0
fi

STATUS="${DEPLOY_STATUS:-unknown}"
SHORT="${COMMIT_SHA:0:7}"
MSG="$(printf '%s' "${COMMIT_MSG:-}" | head -1)"
ACTOR="${ACTOR:-unknown}"
REPO="${REPO:-}"
RUN_URL="${RUN_URL:-}"

if [ "$STATUS" = "success" ]; then
  EMOJI="🚀"; HEADER="Prod deploy succeeded"
else
  EMOJI="⚠️"; HEADER="Prod deploy ${STATUS}"
fi

# jq builds the payload so commit messages with quotes/specials can't break the JSON.
PAYLOAD="$(jq -n \
  --arg emoji "$EMOJI" --arg header "$HEADER" --arg short "$SHORT" \
  --arg actor "$ACTOR" --arg msg "$MSG" --arg repo "$REPO" --arg run "$RUN_URL" \
  '{
    text: "\($emoji) \($header) — \($repo)@\($short)",
    blocks: [
      { type: "section", text: { type: "mrkdwn",
        text: "\($emoji) *\($header)*\n`\($short)` · \($msg)\nby \($actor)" } },
      { type: "context", elements: [ { type: "mrkdwn",
        text: "DB migrate · API Worker (api.t4diverclub.app) · Trigger jobs   |   <\($run)|run logs>" } ] }
    ]
  }')"

curl -fsS -X POST "$URL" -H 'Content-Type: application/json' -d "$PAYLOAD" -o /dev/null \
  && echo "Slack notification sent (status=${STATUS})"
