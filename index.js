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

const snapinst = {  // Instagram Downloader (remains the same)
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

const SpotifyDown = { // Spotify Downloader
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
                    'sec-ch-ua': '"Not A(Brand";v="8", "Chromium";v="132"',
                    'sec-ch-ua-mobile': '?1',
                    'sec-ch-ua-platform': '"Android"',
                    'sec-fetch-dest': 'empty',
                    'sec-fetch-mode': 'cors',
                    'sec-fetch-site': 'same-origin',
                    'user-agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Mobile Safari/537.36'
                }
            });

            if (!metadataResponse.ok) {
                throw new Error('Failed to fetch metadata');
            }

            const metadata =  (await metadataResponse.json()).data;
              if (!metadata) {
                throw new Error("Invalid metadata received from server.");
              }
              return metadata;


        } catch (error) {
            console.error('Error:', error.message);
            throw error; // Important for handling in route
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
                    'sec-ch-ua': '"Not A(Brand";v="8", "Chromium";v="132"',
                    'sec-ch-ua-mobile': '?1',
                    'sec-ch-ua-platform': '"Android"',
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
            throw error; // Important for handling in route
        }
    }
};


app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Instagram Download Route
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

// Spotify Download Route
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
        // Handle both tracks and albums/playlists
        if (metadata.type === 'track') {
            const downloadLink = await SpotifyDown.download(metadata.link, metadata.title, metadata.artists);
             if (!downloadLink) {
                return res.status(500).json({ error: "Could not retrieve Spotify download link." });
             }
             res.json({ ...metadata, downloadLink }); // Combine metadata and download link
        } else if (metadata.type === 'album' || metadata.type === 'playlist') {
            //For simplicity, only get first
            if(!metadata.tracks || metadata.tracks.length === 0){
               return res.status(400).json({error: "No track in album/playlist"})
            }
            const track = metadata.tracks[0];
            const downloadLink = await SpotifyDown.download(track.link, track.title, track.artists);
             if (!downloadLink) {
               return res.status(500).json({ error: "Could not retrieve Spotify download link." });
             }
            res.json({ ...track, downloadLink }); // Send the first track's info

        } else {
             res.status(400).json({ error: "Unsupported Spotify URL type." });
        }


    } catch (error) {
        res.status(500).json({ error: "An error occurred: " + error.message });
    }
});


app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
