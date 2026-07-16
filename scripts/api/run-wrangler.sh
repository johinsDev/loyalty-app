#!/usr/bin/env bash
#
# Launch wrangler on REAL Node, never Bun. `bun run` prepends its node shim
# (/private/tmp/bun-node-*) to PATH, so wrangler — whose bin is `#!/usr/bin/env
# node` — ends up on the Bun runtime it explicitly doesn't support. Under Bun,
# the dev InspectorProxyWorker's WebSocket handshake dies with "Unexpected
# server response: 101" and `wrangler dev` exits 1, taking the whole turbo dev
# down. Stripping the shim from PATH lets `env node` resolve the system Node.
set -euo pipefail

PATH="$(printf '%s' "$PATH" | tr ':' '\n' | grep -v '/bun-node-' | paste -sd: -)"
export PATH
# Bun also exports NODE pointing at the shim; drop it so nothing re-resolves it.
unset NODE

if ! command -v node >/dev/null 2>&1; then
  echo "run-wrangler.sh: no real Node on PATH after removing Bun's shim" >&2
  exit 1
fi

exec wrangler "$@"
