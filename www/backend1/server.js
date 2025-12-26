const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(express.json());
app.use(express.static('public')); // For serving frontend files

// WebSocket for real-time notifications
const wss = new WebSocket.Server({ port: 8080 });

// Store active downloads
const activeDownloads = new Map();

// Serve notification sound
app.get('/notification.mp3', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'notification.mp3'));
});

/**
 * MAIN ENDPOINT: Get DIRECT download links from YT5S
 * User downloads DIRECTLY from YT5S servers, NOT from your server
 */
app.get('/api/yt5s-direct/:videoId', async (req, res) => {
    const { videoId } = req.params;
    const sessionId = `session_${Date.now()}`;

    // Initial notification
    sendNotification(sessionId, {
        type: 'started',
        message: 'Finding download links...',
        videoId: videoId
    });

    try {
        const yt5sUrl = `https://yt5s.com/en19?v=${videoId}`;

        sendNotification(sessionId, {
            type: 'processing',
            message: 'Connecting to YT5S...',
            progress: 25
        });

        // Fetch YT5S page
        const response = await axios.get(yt5sUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
            },
            timeout: 10000
        });

        sendNotification(sessionId, {
            type: 'processing',
            message: 'Extracting download links...',
            progress: 50
        });

        const $ = cheerio.load(response.data);
        const downloadLinks = { mp4: [], mp3: [] };

        // STRATEGY 1: Find direct download buttons
        $('a[href*="download"], a[href*=".mp"], button[data-url]').each((i, element) => {
            const href = $(element).attr('href') || $(element).attr('data-url');
            const text = $(element).text().toLowerCase();

            if (href && href.includes('http')) {
                if (text.includes('mp4') || href.includes('.mp4')) {
                    const quality = text.match(/\d+p/) ? text.match(/\d+p/)[0] : 'HD';
                    downloadLinks.mp4.push({
                        url: href,
                        quality: quality,
                        type: 'direct',
                        size: text.match(/\d+\.?\d*\s*(MB|GB)/)?.[0] || 'Unknown'
                    });
                }

                if (text.includes('mp3') || href.includes('.mp3')) {
                    const quality = text.match(/\d+\s*kbps/) ? text.match(/\d+\s*kbps/)[0] : '128kbps';
                    downloadLinks.mp3.push({
                        url: href,
                        quality: quality,
                        type: 'direct',
                        size: text.match(/\d+\.?\d*\s*(MB|GB)/)?.[0] || 'Unknown'
                    });
                }
            }
        });

        // STRATEGY 2: Find in JavaScript variables (YT5S uses this)
        const scriptContent = $('script').text();

        // Look for MP4 URLs in JavaScript
        const mp4Regex = /(https?:\/\/[^"']*\.mp4[^"']*)/gi;
        let mp4Match;
        while ((mp4Match = mp4Regex.exec(scriptContent)) !== null) {
            if (mp4Match[1] && !downloadLinks.mp4.some(link => link.url === mp4Match[1])) {
                downloadLinks.mp4.push({
                    url: mp4Match[1],
                    quality: 'Direct',
                    type: 'js_extracted',
                    size: 'Auto'
                });
            }
        }

        // Look for MP3 URLs in JavaScript
        const mp3Regex = /(https?:\/\/[^"']*\.mp3[^"']*)/gi;
        let mp3Match;
        while ((mp3Match = mp3Regex.exec(scriptContent)) !== null) {
            if (mp3Match[1] && !downloadLinks.mp3.some(link => link.url === mp3Match[1])) {
                downloadLinks.mp3.push({
                    url: mp3Match[1],
                    quality: '320kbps',
                    type: 'js_extracted',
                    size: 'Auto'
                });
            }
        }

        // STRATEGY 3: Check for form submissions (YT5S sometimes uses forms)
        $('form').each((i, form) => {
            const action = $(form).attr('action');
            const method = $(form).attr('method') || 'POST';

            if (action && action.includes('download')) {
                const inputs = {};
                $(form).find('input[type="hidden"]').each((j, input) => {
                    inputs[$(input).attr('name')] = $(input).attr('value');
                });

                downloadLinks.mp4.push({
                    url: action,
                    quality: 'Form-based',
                    type: 'form',
                    method: method,
                    data: inputs,
                    note: 'Submit this form to get download'
                });
            }
        });

        // If no links found, try alternative YT5S domains
        if (downloadLinks.mp4.length === 0 && downloadLinks.mp3.length === 0) {
            sendNotification(sessionId, {
                type: 'warning',
                message: 'Trying alternative YT5S domains...',
                progress: 70
            });

            // Try different YT5S domains
            const altDomains = [
                'https://yt5s.io/en19?v=',
                'https://yt5s.cc/en19?v=',
                'https://yt5s.net/en19?v='
            ];

            for (const domain of altDomains) {
                try {
                    const altResponse = await axios.get(`${domain}${videoId}`, {
                        timeout: 5000
                    });
                    const altHtml = altResponse.data;

                    // Quick regex search for MP4/MP3
                    const foundMp4 = altHtml.match(/(https?:\/\/[^"']*\.mp4[^"']*)/);
                    const foundMp3 = altHtml.match(/(https?:\/\/[^"']*\.mp3[^"']*)/);

                    if (foundMp4) {
                        downloadLinks.mp4.push({
                            url: foundMp4[0],
                            quality: 'Alternative',
                            type: 'alt_domain',
                            source: domain
                        });
                    }

                    if (foundMp3) {
                        downloadLinks.mp3.push({
                            url: foundMp3[0],
                            quality: 'Alternative',
                            type: 'alt_domain',
                            source: domain
                        });
                    }

                    if (foundMp4 || foundMp3) break;
                } catch (e) {
                    continue;
                }
            }
        }

        // Final result
        if (downloadLinks.mp4.length > 0 || downloadLinks.mp3.length > 0) {
            sendNotification(sessionId, {
                type: 'success',
                message: 'Download links ready!',
                progress: 100,
                sound: true
            });

            // Play sound notification
            setTimeout(() => {
                sendNotification(sessionId, {
                    type: 'sound',
                    message: 'Playing notification sound...',
                    soundUrl: '/notification.mp3'
                });
            }, 100);

            res.json({
                success: true,
                videoId: videoId,
                message: 'USER WILL DOWNLOAD DIRECTLY FROM THESE LINKS (not from our server)',
                instructions: 'Open these URLs in browser/download manager',
                yt5s_page: yt5sUrl,
                links: downloadLinks,
                sessionId: sessionId,
                download_note: 'These are DIRECT links to YT5S/Google servers'
            });

        } else {
            sendNotification(sessionId, {
                type: 'error',
                message: 'No download links found',
                progress: 0
            });

            res.status(404).json({
                success: false,
                error: 'Could not find any download links',
                debug: {
                    title: $('title').text(),
                    pageLength: response.data.length
                }
            });
        }

    } catch (error) {
        console.error('YT5S Error:', error.message);

        sendNotification(sessionId, {
            type: 'error',
            message: `Failed: ${error.message}`,
            progress: 0
        });

        res.status(500).json({
            success: false,
            error: 'YT5S service unavailable',
            details: error.message,
            fallback: `https://ssyoutube.com/watch?v=${videoId}`
        });
    }
});

/**
 * SIMPLE ENDPOINT: Just get YT5S page URL
 */
app.get('/api/simple/:videoId', (req, res) => {
    const videoId = req.params.videoId;
    const yt5sUrl = `https://yt5s.com/en19?v=${videoId}`;

    res.json({
        success: true,
        direct_page: yt5sUrl,
        instructions: 'Open this URL. User will download from YT5S directly.'
    });
});

/**
 * TEST ENDPOINT: Check if YT5S is working
 */
app.get('/api/test/:videoId', async (req, res) => {
    const videoId = req.params.videoId || 'dQw4w9WgXcQ';

    try {
        const response = await axios.get(`https://yt5s.com/en19?v=${videoId}`, {
            timeout: 5000
        });

        res.json({
            status: 'YT5S is working',
            title: response.data.match(/<title>([^<]+)<\/title>/)?.[1] || 'Unknown',
            hasMp4: response.data.includes('.mp4'),
            hasMp3: response.data.includes('.mp3')
        });
    } catch (error) {
        res.json({
            status: 'YT5S might be blocked',
            error: error.message
        });
    }
});

/**
 * WebSocket notification handler
 */
function sendNotification(sessionId, data) {
    activeDownloads.set(sessionId, {
        ...(activeDownloads.get(sessionId) || {}),
        ...data,
        timestamp: Date.now()
    });

    // Broadcast to all WebSocket clients
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
                sessionId: sessionId,
                ...data
            }));
        }
    });

    // Also log to console
    console.log(`[${sessionId}] ${data.type}: ${data.message}`);
}

/**
 * Get notification history
 */
app.get('/api/notifications/:sessionId', (req, res) => {
    const sessionData = activeDownloads.get(req.params.sessionId);
    res.json(sessionData || { error: 'No session found' });
});

// Create public directory for frontend files
if (!fs.existsSync('public')) {
    fs.mkdirSync('public');
}

// Create a simple frontend HTML in public folder
const frontendHtml = `
<!DOCTYPE html>
<html>
<head>
    <title>Background Downloader</title>
    <style>
        body { font-family: Arial; padding: 20px; }
        input { width: 400px; padding: 10px; }
        button { padding: 10px 20px; margin: 5px; background: #4CAF50; color: white; border: none; cursor: pointer; }
        .notification { background: #333; color: white; padding: 10px; margin: 10px 0; border-radius: 5px; }
        .link { display: block; padding: 8px; background: #f0f0f0; margin: 5px 0; }
    </style>
</head>
<body>
    <h2>Download Without Redirect</h2>
    <input id="videoUrl" placeholder="YouTube URL">
    <button onclick="getLinks()">Get Download Links</button>

    <div id="notifications"></div>
    <div id="links"></div>

    <audio id="sound" src="/notification.mp3" preload="auto"></audio>

    <script>
        const ws = new WebSocket('ws://localhost:8080');

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            showNotification(data.message);

            if (data.soundUrl) {
                document.getElementById('sound').play();
            }
        };

        async function getLinks() {
            const url = document.getElementById('videoUrl').value;
            const videoId = extractVideoId(url);

            if (!videoId) {
                alert('Invalid YouTube URL');
                return;
            }

            showNotification('Finding download links...');

            const response = await fetch('/api/yt5s-direct/' + videoId);
            const data = await response.json();

            if (data.success) {
                showNotification('Links ready! Download will start...');
                document.getElementById('sound').play();

                // Auto-download first MP4 link
                if (data.links.mp4.length > 0) {
                    setTimeout(() => {
                        window.open(data.links.mp4[0].url, '_blank');
                    }, 1000);
                }

                // Show all links
                let html = '<h3>Download Links:</h3>';
                data.links.mp4.forEach(link => {
                    html += \`<div class="link">
                        <strong>MP4 (\${link.quality})</strong>
                        <button onclick="downloadFile('\${link.url}')">Download</button>
                    </div>\`;
                });
                data.links.mp3.forEach(link => {
                    html += \`<div class="link">
                        <strong>MP3 (\${link.quality})</strong>
                        <button onclick="downloadFile('\${link.url}')">Download</button>
                    </div>\`;
                });

                document.getElementById('links').innerHTML = html;
            }
        }

        function downloadFile(url) {
            // User downloads DIRECTLY from YT5S
            window.open(url, '_blank');
            document.getElementById('sound').play();
        }

        function showNotification(msg) {
            const div = document.createElement('div');
            div.className = 'notification';
            div.textContent = msg;
            document.getElementById('notifications').prepend(div);
        }

        function extractVideoId(url) {
            const regExp = /^.*(youtu.be\\/|v\\/|u\\/\\w\\/|embed\\/|watch\\?v=|&v=)([^#&?]*).*/;
            const match = url.match(regExp);
            return (match && match[2].length === 11) ? match[2] : null;
        }
    </script>
</body>
</html>
`;

fs.writeFileSync('public/index.html', frontendHtml);

// Start servers
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════════╗
║   YT5S Link Extractor Server Running!    ║
╚══════════════════════════════════════════╝
✅ Server: http://localhost:${PORT}
✅ WebSocket: ws://localhost:8080
✅ Frontend: http://localhost:${PORT}/index.html

📌 ENDPOINTS:
  GET /api/yt5s-direct/:videoId  - Get direct YT5S download links
  GET /api/simple/:videoId       - Just get YT5S page URL
  GET /api/test/:videoId         - Test if YT5S is working

🎯 KEY FEATURES:
  • NO file handling on your server
  • User downloads DIRECTLY from YT5S
  • WebSocket notifications
  • Sound alerts when ready
  • Background processing

⚠️ IMPORTANT:
  Your server only finds links, user downloads from YT5S directly!
  No files pass through your server.
    `);
});

// Create package.json if not exists
if (!fs.existsSync('package.json')) {
    const packageJson = {
        name: "yt5s-link-extractor",
        version: "1.0.0",
        main: "server.js",
        dependencies: {
            "express": "^4.18.0",
            "axios": "^1.6.0",
            "cheerio": "^1.0.0",
            "ws": "^8.14.0"
        }
    };
    fs.writeFileSync('package.json', JSON.stringify(packageJson, null, 2));
}

console.log(`
📦 To install dependencies:
   npm install express axios cheerio ws

🚀 To start:
   node server.js

🎮 Test with:
   curl http://localhost:3000/api/test/dQw4w9WgXcQ
`);