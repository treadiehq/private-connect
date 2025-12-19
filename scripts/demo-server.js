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
  
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    message: 'Hello from demo service!',
    timestamp,
    path: req.url,
    method: req.method,
    headers: req.headers
  }, null, 2));
});

server.listen(PORT, () => {
  console.log(`🚀 Demo server running at http://127.0.0.1:${PORT}`);
  console.log('   Use this with: connect expose 127.0.0.1:9000 --name demo-http');
});

process.on('SIGINT', () => {
  console.log('\n👋 Shutting down demo server...');
  server.close(() => process.exit(0));
});

