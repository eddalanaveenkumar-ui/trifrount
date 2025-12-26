// Simple Node.js backend proxy for YouTube video downloads
// This file can be deployed to services like Vercel, Netlify, or your own server
//
// To use:
// 1. Install dependencies: npm install express cors ytdl-core
// 2. Run: node backend-proxy.js
// 3. Update the API_URL in download-manager.js to point to this server

const express = require('express');
const cors = require('cors');
const ytdl = require('ytdl-core');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for all origins (restrict this in production)
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/', (req, res) => {
    res.json({ status: 'YouTube Download Proxy Server Running' });
});

// Get video info endpoint
app.get('/api/video-info/:videoId', async (req, res) => {
    try {
        const { videoId } = req.params;
        const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

        const info = await ytdl.getInfo(videoUrl);

        // Get the best format with both video and audio
        const formats = ytdl.filterFormats(info.formats, 'videoandaudio');
        const bestFormat = formats.find(f => f.qualityLabel === '720p') || formats[0];

        res.json({
            success: true,
            videoId: videoId,
            title: info.videoDetails.title,
            downloadUrl: bestFormat.url,
            quality: bestFormat.qualityLabel,
            size: bestFormat.contentLength
        });
    } catch (error) {
        console.error('Error fetching video info:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Download video endpoint (streams the video)
app.get('/api/download/:videoId', async (req, res) => {
    try {
        const { videoId } = req.params;
        const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

        const info = await ytdl.getInfo(videoUrl);
        const format = ytdl.chooseFormat(info.formats, { quality: '18' }); // 360p MP4

        res.header('Content-Disposition', `attachment; filename="${info.videoDetails.title}.mp4"`);
        res.header('Content-Type', 'video/mp4');

        ytdl(videoUrl, { format: format })
            .pipe(res)
            .on('error', (error) => {
                console.error('Stream error:', error);
                res.status(500).end();
            });
    } catch (error) {
        console.error('Error downloading video:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

app.listen(PORT, () => {
    console.log(`YouTube Download Proxy Server running on port ${PORT}`);
    console.log(`Access at: http://localhost:${PORT}`);
});
