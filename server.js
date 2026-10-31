// Custom server for self-hosting on ISPmanager's Node.js app runner, which
// execs package.json's "main" file directly (not through `npm start`), so a
// bare `next start` fails with "command not found" — no node_modules/.bin on
// PATH. `require('next')` here sidesteps that entirely.
//
// Optional multi-process mode: Node is single-threaded for JS, so one process
// pins one CPU core while SSR-rendering pages under load. This host has 3
// cores and 4 GB RAM. Default is 1 worker — identical to the previous
// behaviour, nothing changes on deploy. Set WEB_CONCURRENCY=2 in the
// environment and Restart to run a second worker on a second core (leave the
// third core for Postgres, nginx and sharp). Each worker is a full Next.js
// process (~300–500 MB resident), so watch RAM after raising it and drop back
// to 1 if memory gets tight. The cluster module shares the listening port
// across workers automatically (round-robin on Linux).
const { createServer } = require("http");
const cluster = require("cluster");
const next = require("next");

const port = process.env.PORT || 3000;
const hostname = process.env.INSTANCE_HOST || "0.0.0.0";
const workers = Math.max(1, Number(process.env.WEB_CONCURRENCY) || 1);

function startServer() {
  const app = next({ dev: false });
  const handle = app.getRequestHandler();
  app.prepare().then(() => {
    createServer((req, res) => handle(req, res)).listen(port, hostname, () => {
      console.log(`ready on http://${hostname}:${port} (pid ${process.pid})`);
    });
  });
}

if (workers > 1 && cluster.isPrimary) {
  console.log(`primary ${process.pid}: starting ${workers} workers`);
  for (let i = 0; i < workers; i++) cluster.fork();
  // Respawn a worker that dies so one bad request can't permanently shrink the
  // pool and leave the site running on fewer cores than intended.
  cluster.on("exit", (worker, code, signal) => {
    console.error(`worker ${worker.process.pid} exited (${signal || code}); respawning`);
    cluster.fork();
  });
} else {
  startServer();
}
