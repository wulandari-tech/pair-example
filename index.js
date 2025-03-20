// --- Backend (Node.js - server.js) ---

const http = require('http');
const fs = require('fs');
const url = require('url');

const dataFile = 'data.json';

// Utility function to read data
function readData() {
    try {
        const data = fs.readFileSync(dataFile, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error("Error reading data file:", error); // Log the error
        return { products: [], messages: {} }; // Return default data
    }
}

// Utility function to write data
function writeData(data) {
    try {
        fs.writeFileSync(dataFile, JSON.stringify(data, null, 2), 'utf8');
    } catch (error) {
        console.error("Error writing to data file:", error); // Log the error
    }
}

const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;
    const query = parsedUrl.query;

    // --- Helper function to serve files ---
    function serveFile(filename, res, contentType = 'text/html') {
        fs.readFile(filename, (err, data) => {
            if (err) {
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end('Internal Server Error');
                return;
            }
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(data);
        });
    }

    // --- Routing ---
    if (pathname === '/') {
        serveFile('index.html', res);
    } else if (pathname === '/login/') {
        serveFile('login.html', res);  // You'll need to create login.html
    } else if (pathname === '/daftar/') {
        serveFile('daftar.html', res); // You'll need to create daftar.html
    } else if (pathname === '/docs/') {
        serveFile('docs.html', res);
    } else if (pathname === '/message/') {
        serveFile('message.html', res);
    } else if (pathname === '/admin/' && req.method === 'GET') {
        const authHeader = req.headers.authorization;

        // Basic Auth (VERY SIMPLE - DO NOT USE IN PRODUCTION)
        if (authHeader) {
            const auth = Buffer.from(authHeader.split(' ')[1], 'base64').toString().split(':');
            const user = auth[0];
            const pass = auth[1];

            if (user === 'wanzofc' && pass === 'wanz321') {
                serveFile('admin.html', res);
                return;
            }
        }

        // Unauthorized
        res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="Admin Area"' });
        res.end('Unauthorized');

    } else if (pathname === '/addProduct' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', () => {
            try {
                const newProduct = JSON.parse(body);
                const data = readData();
                newProduct.id = Date.now().toString(); // Simple ID
                data.products.push(newProduct);
                writeData(data);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ message: 'Produk berhasil ditambahkan!' }));
            } catch (error) {
                console.error("Error parsing JSON in /addProduct:", error); // Log parsing errors
                res.writeHead(400, { 'Content-Type': 'application/json' }); // 400 Bad Request
                res.end(JSON.stringify({ message: 'Invalid JSON data' }));
            }
        });

    } else if (pathname === '/getProducts' && req.method === 'GET') {
        const data = readData();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data.products));

    } else if (pathname === '/sendMessage' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', () => {
            try {
                const newMessage = JSON.parse(body);
                const data = readData();

                if (!data.messages[newMessage.productId]) {
                    data.messages[newMessage.productId] = [];
                }
                data.messages[newMessage.productId].push(newMessage);
                writeData(data);

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ message: 'Pesan terkirim!' }));
            } catch (error) {
                console.error("Error parsing JSON in /sendMessage:", error);
                 res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ message: 'Invalid JSON data' }));
            }
        });

    } else if (pathname === '/getMessages' && req.method === 'GET') {
        const productId = query.productId;
        const data = readData();
        const productMessages = (data.messages && data.messages[productId]) || [];
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ messages: productMessages }));

    } else if (pathname === '/getAllMessages' && req.method === 'GET') {
        const data = readData();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data.messages));

    }  else if (pathname.startsWith('/')) {
          // Handle dynamic short URLs (e.g., /shortcode/productId)
          const parts = pathname.split('/');
          if(parts.length === 3) {
            const shortCode = parts[1]
            const productId = parts[2]
            //redirect costumer to message
            // Set the selectedProductId in a cookie (more reliable than localStorage for cross-page access)
             res.writeHead(302, {  // 302 Found (Temporary Redirect)
                'Location': '/message/',
                'Set-Cookie': `selectedProductId=${productId}; Path=/; HttpOnly` // Set cookie, HttpOnly for security
                });
            res.end();
            return;
          }
      }
    else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found');
    }
});

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    // Create data.json if it doesn't exist
    if (!fs.existsSync(dataFile)) {
        writeData({ products: [], messages: {} });
        console.log('data.json created.');
    }
});
