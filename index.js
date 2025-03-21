const axios = require('axios');
const cheerio = require('cheerio');
const FormData = require('form-data');
const express = require('express');
const path = require('path');
const app = express();
const port = 3000;

app.use(express.urlencoded({ extended: true }));
app.use(express.json()); //  Handle JSON requests
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
            form.append('cf-turnstile-response', ''); // Remove if causing errors
            form.append('token', $('input[name=token]').attr('value'));

            const headers = {
                ...form.getHeaders(),
                'accept': '*/*',
                'accept-language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
                'sec-ch-ua': '"Not A(Brand";v="8", "Chromium";v="132"', //Update if needed
                'sec-ch-ua-mobile': '?1',
                'sec-ch-ua-platform': '"Android"',  // Update if needed
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
                res.urls.push(url); // Only store the URL
            });

            return res;
        } catch (error) {
            console.error("Error in snapinst.app:", error);
            throw error; // Re-throw for handling in the route
        }
    },
};

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

//  Handle the download request and send JSON
app.post('/download', async (req, res) => {
    try {
        const instagramUrl = req.body.url;
        if (!instagramUrl) {
            return res.status(400).json({ error: "Instagram URL cannot be empty." });
        }

        const result = await snapinst.app(instagramUrl);
        res.json(result); // Send the result as JSON

    } catch (error) {
        res.status(500).json({ error: "An error occurred: " + error.message });
    }
});


app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
