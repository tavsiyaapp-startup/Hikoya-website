// Custom server for self-hosting on ISPmanager's Node.js app runner, which
// execs package.json's "main" file directly (not through `npm start`), so a
// bare `next start` fails with "command not found" — no node_modules/.bin on
// PATH. `require('next')` here sidesteps that entirely.
const { createServer } = require("http");
const next = require("next");

const port = process.env.PORT || 3000;
const hostname = process.env.INSTANCE_HOST || "0.0.0.0";
const app = next({ dev: false });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer((req, res) => handle(req, res)).listen(port, hostname, () => {
    console.log(`ready on http://${hostname}:${port}`);
  });
});
