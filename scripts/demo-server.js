#!/usr/bin/env node
/**
 * Simple demo HTTP server for testing Private Connect
 * Run with: node scripts/demo-server.js
 */

const http = require('http');

const PORT = process.env.PORT || 9000;

const server = http.createServer((req, res) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.url}`);

  let body;
  if (req.url === '/health' || req.url === '/healthz') {
    body = { status: 'ok', timestamp };
  } else if (req.url === '/status') {
    body = { status: 'ok', uptime: process.uptime(), timestamp };
  } else if (req.url === '/version') {
    body = { version: '1.0.0-demo', timestamp };
  } else {
    body = {
      message: 'Hello from demo service!',
      timestamp,
      path: req.url,
      method: req.method,
    };
  }

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body, null, 2));
});

server.listen(PORT, () => {
  console.log(`🚀 Demo server running at http://127.0.0.1:${PORT}`);
  console.log('   Endpoints: /health, /status, /version, /');
  console.log('   Use with Ask page: Service = http://localhost:' + PORT + ', then ask "Is it healthy?"');
  console.log('   Or: connect expose 127.0.0.1:' + PORT + ' --name demo-http');
});

process.on('SIGINT', () => {
  console.log('\n👋 Shutting down demo server...');
  server.close(() => process.exit(0));
});

