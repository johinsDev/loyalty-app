// Waits until the Dockerized Postgres accepts TCP connections on the
// published host port (5433 by default). Used before host-run
// `db:migrate:docker` so the migration doesn't race the container.
//
// Usage: bun run scripts/db/wait-for-postgres.ts [host] [port] [timeoutMs]

const host = process.argv[2] ?? "localhost";
const port = Number(process.argv[3] ?? 5433);
const timeoutMs = Number(process.argv[4] ?? 60_000);

const deadline = Date.now() + timeoutMs;

async function tryConnect(): Promise<boolean> {
  try {
    const socket = await Bun.connect({
      hostname: host,
      port,
      socket: { data() {}, error() {} },
    });
    socket.end();
    return true;
  } catch {
    return false;
  }
}

while (Date.now() < deadline) {
  if (await tryConnect()) {
    console.info(`✓ Postgres reachable at ${host}:${port}`);
    process.exit(0);
  }
  await Bun.sleep(1000);
}

console.error(`✗ Postgres not reachable at ${host}:${port} within ${timeoutMs}ms`);
process.exit(1);
