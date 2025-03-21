// server.js
const axios = require('axios');
const cheerio = require('cheerio');
const FormData = require('form-data');
const express = require('express');
const path = require('path');
const app = express();
const port = 3000;

app.use(express.urlencoded({ extended: true }));
app.use(express.json()); // Penting untuk menerima data JSON dari client
app.use(express.static(path.join(__dirname)));

const snapinst = {
    async app(url) {
        try {
            const { data } = await axios.get('https://snapinst.app/');
            const $ = cheerio.load(data);
            const form = new FormData();

            form.append('url', url);
            form.append('action', 'post');
            form.append('lang', '');
            form.append('cf-turnstile-response', ''); // Hapus kalau error
            form.append('token', $('input[name=token]').attr('value'));

            const headers = {
                ...form.getHeaders(),
                'accept': '*/*',
                'accept-language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
                'sec-ch-ua': '"Not A(Brand";v="8", "Chromium";v="132"',
                'sec-ch-ua-mobile': '?1',
                'sec-ch-ua-platform': '"Android"',
                'sec-fetch-dest': 'empty',
                'sec-fetch-mode': 'cors',
                'sec-fetch-site': 'same-origin',
                'Referer': 'https://snapinst.app/',
                'Referrer-Policy': 'strict-origin-when-cross-origin'
            };

            const jsbejad = await axios.post('https://snapinst.app/action2.php', form, { headers });
            const ayok = new Function('callbuk', jsbejad.data.replace('eval', 'callbuk'));

            const html = await new Promise((resolve, reject) => {
                ayok(t => {
                    const code = t.split(".innerHTML = ")[1].split("; document.")[0];
                    resolve(eval(code));
                });
            });

            const _ = cheerio.load(html);
            const res = {
                avatar: _('.row img:eq(0)').attr('src'),
                username: _('.row div.left:eq(0)').text().trim(),
                urls: []
            };
            _('.row .download-item').each((i, e) => {
                const url = _(e).find('.download-bottom a').attr('href');
                const type = url.includes('.mp4') ? 'video' : 'image'; // Cek tipe konten
                res.urls.push({ url, type });
            });

            return res;
        } catch (error) {
            console.error("Error in snapinst.app:", error);
            throw error; // Re-throw agar bisa ditangani di route
        }
    },
};


// Route utama ("/")
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Route untuk menangani permintaan download
app.post('/download', async (req, res) => {
    try {
        const instagramUrl = req.body.url;
        if (!instagramUrl) {
            return res.status(400).json({ error: "URL Instagram tidak boleh kosong." }); // Kirim error sebagai JSON
        }

        const result = await snapinst.app(instagramUrl);
        res.json(result); // Kirim hasil sebagai JSON ke client

    } catch (error) {
        res.status(500).json({ error: "Terjadi kesalahan: " + error.message }); // Kirim error sebagai JSON
    }
});


app.listen(port, () => {
    console.log(`Server berjalan di http://localhost:${port}`);
});
