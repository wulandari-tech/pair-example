const axios = require('axios');
const cheerio = require('cheerio');
const FormData = require('form-data');
const express = require('express');
const app = express();
const port = 3000;

app.use(express.urlencoded({ extended: true }));

const snapinst = {
    async app(url) {
        try {
            const { data } = await axios.get('https://snapinst.app/');
            const $ = cheerio.load(data);
            const form = new FormData();

            form.append('url', url);
            form.append('action', 'post');
            form.append('lang', '');
            form.append('cf-turnstile-response', ''); //Hapus jika error
            form.append('token', $('input[name=token]').attr('value'));

            const headers = {
                ...form.getHeaders(),
                'accept': '*/*',
                'accept-language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
                'sec-ch-ua': '"Not A(Brand";v="8", "Chromium";v="132"',  //Update jika perlu
                'sec-ch-ua-mobile': '?1',
                'sec-ch-ua-platform': '"Android"',   // Update jika perlu
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
                res.urls.push(_(e).find('.download-bottom a').attr('href'));
            });

            return res;
        } catch (error) {
            console.error("Error in snapinst.app:", error);
            throw error; // Re-throw agar bisa ditangani di route
        }
    },
};

// Route utama ("/") - Menampilkan form
app.get('/', (req, res) => {
    const htmlForm = `
    <h1>Download Instagram</h1>
    <form action="/download" method="post">
        <label for="url">Masukkan URL Instagram:</label><br>
        <input type="text" id="url" name="url" style="width: 300px;" required><br><br>
        <button type="submit">Download</button>
    </form>
    `;
    res.send(htmlForm);
});

// Route untuk menangani permintaan download
app.post('/download', async (req, res) => {
    try {
        const instagramUrl = req.body.url;
        if (!instagramUrl) {
          return res.status(400).send("URL Instagram tidak boleh kosong.");
        }

        const result = await snapinst.app(instagramUrl);

        let htmlResult = `<h1>Hasil Download</h1>`;
         if (result.avatar) {
              htmlResult += `<img src="${result.avatar}" alt="Avatar" style="max-width: 100px;"><br>`;
         }
        htmlResult += `<p>Username: ${result.username}</p>`;
        htmlResult += `<h2>Link Download:</h2><ul>`;
        result.urls.forEach(url => {
            htmlResult += `<li><a href="${url}" target="_blank">Download</a></li>`;
        });
        htmlResult += `</ul>`;
        htmlResult += `<a href="/">Kembali</a>`; // Tombol kembali

        res.send(htmlResult);

    } catch (error) {
        res.status(500).send("Terjadi kesalahan: " + error.message + "<br><a href='/'>Kembali</a>");
    }
});


app.listen(port, () => {
    console.log(`Server berjalan.  Download Instagram di http://localhost:${port}`);
});
