import { MarketStore } from '../../../adapters/persistence/store.mjs';
import { createHuntlabServer } from './server.mjs';

const store = new MarketStore(process.env.HUNTLAB_DATABASE ?? './huntlab.db');
const app = createHuntlabServer({
  store,
  refreshSeconds: Number(process.env.HUNTLAB_REFRESH_SECONDS ?? 60),
  staleAfterMs: Number(process.env.HUNTLAB_STALE_AFTER_MS ?? 120_000),
});

const host = process.env.HUNTLAB_HOST ?? '127.0.0.1';
const port = Number(process.env.HUNTLAB_PORT ?? 8080);
app.server.listen(port, host, () => {
  console.log(`HuntLab listening on http://${host}:${port}`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, async () => {
    await app.close();
    store.close();
    process.exit(0);
  });
}
