const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  // Convert URL to file path
  let filePath = req.url === '/' 
    ? path.join(__dirname, 'index.html')
    : path.join(__dirname, req.url);

  // Get file extension
  const extname = String(path.extname(filePath)).toLowerCase();
  
  // Set default content type
  const contentType = MIME_TYPES[extname] || 'application/octet-stream';

  // Read file
  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === 'ENOENT') {
        // File not found, serve index.html for SPA fallback or return 404
        fs.readFile(path.join(__dirname, '404.html'), (err, 404Content) => {
          res.writeHead(404, { 'Content-Type': 'text/html' });
          res.end(404Content || '<h1>404 Not Found</h1>', 'utf-8');
        });
      } else {
        // Server error
        res.writeHead(500);
        res.end(`Server Error: ${error.code}`);
      }
    } else {
      // Success
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

server.listen(PORT, () => {
  console.log(`==================================================`);
  console.log(`  AI Language Teacher Server is running!`);
  console.log(`  Access the app at: http://localhost:${PORT}`);
  console.log(`==================================================`);
});
