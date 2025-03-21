// server.js
const axios = require('axios');
const cheerio = require('cheerio');
const FormData = require('form-data');
const express = require('express');
const path = require('path');
const app = express();
const port = 3000;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// --- Instagram Downloader (snapinst) ---
const snapinst = {
    async app(url) {
        try {
            const { data } = await axios.get('https://snapinst.app/');
            const $ = cheerio.load(data);
            const form = new FormData();

            form.append('url', url);
            form.append('action', 'post');
            form.append('lang', '');
            form.append('cf-turnstile-response', ''); // Remove if errors
            form.append('token', $('input[name=token]').attr('value'));

            const headers = {
                ...form.getHeaders(),
                'accept': '*/*',
                'accept-language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
                 'sec-ch-ua': '"Not A(Brand";v="8", "Chromium";v="132"', // Update if needed
                'sec-ch-ua-mobile': '?1',
                'sec-ch-ua-platform': '"Android"', // Update if needed
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
                res.urls.push(url);
            });

            return res;
        } catch (error) {
            console.error("Error in snapinst.app:", error);
            throw error;
        }
    },
};

// --- Spotify Downloader (SpotifyDown) ---
const SpotifyDown = {
    async metadata(url) {
        try {
            const metadataResponse = await fetch(`https://spotify-down.com/api/metadata?link=${encodeURIComponent(url)}`, {
                method: 'POST',
                headers: {
                    'authority': 'spotify-down.com',
                    'accept': '*/*',
                    'accept-language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
                    'content-length': '0',
                    'content-type': 'application/json',
                    'origin': 'https://spotify-down.com',
                    'referer': 'https://spotify-down.com/',
                     'sec-ch-ua': '"Not A(Brand";v="8", "Chromium";v="132"', // Update if needed
                    'sec-ch-ua-mobile': '?1',
                    'sec-ch-ua-platform': '"Android"',  // Update if needed
                    'sec-fetch-dest': 'empty',
                    'sec-fetch-mode': 'cors',
                    'sec-fetch-site': 'same-origin',
                    'user-agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Mobile Safari/537.36'
                }
            });

            if (!metadataResponse.ok) {
                throw new Error('Failed to fetch metadata');
            }

            const metadata = (await metadataResponse.json()).data;
            if (!metadata) {
                throw new Error("Invalid metadata received from server.");
            }
            return metadata;

        } catch (error) {
            console.error('Error:', error.message);
            throw error;
        }
    },
    async download(url, title, artist) {
        try {
            const downloadResponse = await fetch(`https://spotify-down.com/api/download?link=${encodeURIComponent(url)}&n=${encodeURIComponent(title)}&a=${encodeURIComponent(artist)}`, {
                headers: {
                    'authority': 'spotify-down.com',
                    'accept': '*/*',
                    'accept-language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
                    'referer': 'https://spotify-down.com/',
                     'sec-ch-ua': '"Not A(Brand";v="8", "Chromium";v="132"', // Update if needed
                    'sec-ch-ua-mobile': '?1',
                    'sec-ch-ua-platform': '"Android"',  // Update if needed
                    'sec-fetch-dest': 'empty',
                    'sec-fetch-mode': 'cors',
                    'sec-fetch-site': 'same-origin',
                    'user-agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Mobile Safari/537.36'
                }
            });

            if (!downloadResponse.ok) {
                throw new Error('Failed to fetch download URL');
            }

            const downloadData = await downloadResponse.json();
            if (!downloadData || !downloadData.data || !downloadData.data.link) {
                throw new Error("Invalid download data received from server.");
            }

            return {
                url: downloadData.data.link
            };
        } catch (error) {
            console.error('Error:', error.message);
            throw error;
        }
    }
};

// --- TikTok/Douyin Downloader (SnapDouyin) ---
function calculateHash(url, salt) {
    return btoa(url) + (url.length + 1_000) + btoa(salt);
}

async function SnapDouyin(url) {
    try {
        const re1 = await axios.get('https://snapdouyin.app/id');
        const token = re1.data.split('<input id="token" type="hidden" name="token" value="')[1].split('"')[0];
        const headers = {
            'Content-Type': 'application/x-www-form-urlencoded'
        };

        const body = new URLSearchParams();
        body.append('url', url);
        body.append('token', token);
        body.append('hash', calculateHash(url, 'aio-dl'));

        const res = await axios.post(`https://snapdouyin.app/wp-json/mx-downloader/video-data/`, body.toString(), { headers });
        return res.data;  // Directly return the data
    } catch(error){
        console.error("Error in SnapDouyin:", error);
        throw error; // Re-throw for handling in the route.
    }
}

// --- Routes ---
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Instagram
app.post('/download', async (req, res) => {
    try {
        const instagramUrl = req.body.url;
        if (!instagramUrl) {
            return res.status(400).json({ error: "Instagram URL cannot be empty." });
        }
        const result = await snapinst.app(instagramUrl);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: "An error occurred: " + error.message });
    }
});

// Spotify
app.post('/spotify-download', async (req, res) => {
    try {
        const spotifyUrl = req.body.url;
        if (!spotifyUrl) {
            return res.status(400).json({ error: "Spotify URL cannot be empty." });
        }

        const metadata = await SpotifyDown.metadata(spotifyUrl);
        if (!metadata) {
          return res.status(500).json({ error: "Could not retrieve Spotify metadata." });
        }

        if (metadata.type === 'track') {
            const downloadLink = await SpotifyDown.download(metadata.link, metadata.title, metadata.artists);
            if (!downloadLink) {
               return res.status(500).json({ error: "Could not retrieve Spotify download link." });
            }
            res.json({ ...metadata, downloadLink });
        } else if (metadata.type === 'album' || metadata.type === 'playlist') {
            if (!metadata.tracks || metadata.tracks.length === 0) {
               return res.status(400).json({error: "No track in album/playlist"})
            }
            const track = metadata.tracks[0]; //Simplifikasi
            const downloadLink = await SpotifyDown.download(track.link, track.title, track.artists);
             if (!downloadLink) {
                return res.status(500).json({ error: "Could not retrieve Spotify download link." });
             }
            res.json({ ...track, downloadLink });

        } else {
            res.status(400).json({ error: "Unsupported Spotify URL type." });
        }

    } catch (error) {
        res.status(500).json({ error: "An error occurred: " + error.message });
    }
});

// TikTok/Douyin
app.post('/tiktok-download', async (req, res) => {
    try{
        const tiktokUrl = req.body.url;
        if(!tiktokUrl){
            return res.status(400).json({error: "TikTok URL cannot be empty."});
        }
        const result = await SnapDouyin(tiktokUrl);
        res.json(result); // Send result directly

    } catch(error){
      res.status(500).json({ error: "An error occurred: " + error.message });
    }
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
