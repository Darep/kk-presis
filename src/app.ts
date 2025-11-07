import http from 'node:http';
import { env } from 'node:process';

const color = env.COLOR || 'unknown';
const version = env.VERSION || 'unknown';

const server = http.createServer((req, res) => {
  if (req.url === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    return res.end('ok');
  }

  if (req.url === '/version') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    return res.end(version);
  }

  res.writeHead(200, { 'Content-Type': 'text/plain' });

  if (req.headers['user-agent']?.includes('curl')) {
    res.end(`Hello from ${color} ${version}\n`);
  } else {
    res.setHeader('Content-Type', 'text/html');
    res.end(
      `<!DOCTYPE html><html><body style="font-family: sans-serif;"><h1 style="display: flex; justify-content: center; align-items: center; height: 100vh;">Hello from ${color} ${version}</h1></body></html>`
    );
  }
});

const port = process.env.PORT || 8080;
server.listen(port, () => {
  console.log(`listening on :${port} as ${color} ${version}`);
});
