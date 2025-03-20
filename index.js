const http = require('http');
const fs = require('fs');
const url = require('url');

const dataFile = 'data.json';

// Fungsi untuk membaca data dari file JSON
function readData() {
    try {
        const data = fs.readFileSync(dataFile, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        // Jika file tidak ada atau error, kembalikan object awal
        return { products: [], messages: {} };
    }
}

// Fungsi untuk menulis data ke file JSON
function writeData(data) {
    fs.writeFileSync(dataFile, JSON.stringify(data, null, 2), 'utf8');
}

const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;
    const query = parsedUrl.query;

    // --- Routing ---
    if (pathname === '/') {
        serveFile('index.html', res);
    } else if (pathname === '/login/') {
        serveFile('login.html', res);
    } else if (pathname === '/daftar/') {
        serveFile('daftar.html', res);
    } else if (pathname === '/docs/') {
        serveFile('docs.html', res);
  } else if (pathname === '/message/') {
        serveFile('message.html', res);

    } else if (pathname === '/admin/' && req.method === 'GET') {
      const authHeader = req.headers.authorization;

        // Cek Auth Basic (sangat sederhana, JANGAN untuk produksi!)
        if (authHeader) {
          const auth = Buffer.from(authHeader.split(' ')[1], 'base64').toString().split(':');
          const user = auth[0];
          const pass = auth[1];

          if (user === 'wanzofc' && pass === 'wanz321') {
            serveFile('admin.html', res);
            return;
          }
      }

       // Jika tidak terautentikasi
      res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="Admin Area"' });
      res.end('Unauthorized');



    } else if (pathname === '/addProduct' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', () => {
            const newProduct = JSON.parse(body);
            const data = readData();
            newProduct.id = Date.now().toString(); // ID sederhana
            data.products.push(newProduct);
            writeData(data);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ message: 'Produk berhasil ditambahkan!' }));
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
            const newMessage = JSON.parse(body);
            const data = readData();

            // Pastikan productId ada dan buat array pesan jika belum ada
            if (!data.messages[newMessage.productId]) {
                data.messages[newMessage.productId] = [];
            }
              data.messages[newMessage.productId].push(newMessage);
              writeData(data);

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ message: 'Pesan terkirim!' }));
        });

    } else if (pathname === '/getMessages' && req.method === 'GET') {
        const productId = query.productId; // Ambil productId dari query parameter
        const data = readData();
          // Pastikan data.messages dan data.messages[productId] ada sebelum filter
        const productMessages = (data.messages && data.messages[productId]) || [];
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ messages: productMessages }));

    } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found');
    }
});
// Fungsi bantu untuk menyajikan file
function serveFile(filename, res) {
    fs.readFile(filename, (err, data) => {
        if (err) {
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('Internal Server Error');
            return;
        }
        res.writeHead(200, { 'Content-Type': 'text/html' }); // Asumsi semua file adalah HTML
        res.end(data);
    });
}

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    // Buat data.json jika belum ada
    if (!fs.existsSync(dataFile)) {
        writeData({ products: [], messages: {} });
        console.log('data.json created.');
    }
});
