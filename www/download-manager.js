class DownloadManager {
    constructor() {
        this.secretKey = "triangle-app-secret-key";
        this.downloadsKey = "offline_downloads";

        // Use 10.0.2.2 for Android Emulator to access localhost
        // If testing on a real device, replace this with your computer's IP address (e.g., http://192.168.1.5:3000)
        this.backendUrl = "http://10.0.2.2:3000";
    }

    async init() {
        this.cleanupOldVideos();
    }

    getDownloads() {
        return JSON.parse(localStorage.getItem(this.downloadsKey)) || [];
    }

    async isVideoDownloaded(videoId) {
        const downloads = this.getDownloads();
        return downloads.some(v => v.id === videoId);
    }

    async downloadVideo(videoDetails, type = 'video', onProgress) {
        if (await this.isVideoDownloaded(videoDetails.id)) {
            throw new Error("Item already downloaded");
        }

        try {
            // 1. Get download links from your scraping backend
            onProgress(0, 'Fetching link...');
            const responseLink = await fetch(`${this.backendUrl}/api/video-info/${videoDetails.id}`);
            if (!responseLink.ok) {
                throw new Error(`Backend error: ${await responseLink.text()}`);
            }
            const data = await responseLink.json();

            if (!data.success || !data.downloadUrl) {
                throw new Error(data.error || 'No download links found by the server.');
            }

            console.log(`Found link for ${type}:`, data.downloadUrl);

            // 3. Fetch the actual file from the direct link
            onProgress(0, 'Downloading...');
            const response = await fetch(data.downloadUrl);
            if (!response.ok) throw new Error(`File download error: ${response.status}`);

            const contentLength = response.headers.get('content-length');
            const total = parseInt(contentLength, 10);
            let loaded = 0;

            const reader = response.body.getReader();
            const chunks = [];

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                chunks.push(value);
                loaded += value.length;

                if (total && onProgress) {
                    const progress = Math.round((loaded / total) * 100);
                    onProgress(progress, 'Downloading...');
                }
            }

            // 4. Convert to Blob
            const blob = new Blob(chunks, { type: type === 'audio' ? 'audio/mp3' : 'video/mp4' });

            // 5. Convert to Base64 for encryption
            onProgress(100, 'Encrypting...');
            const base64data = await this.blobToBase64(blob);

            // 6. Encrypt
            const encrypted = CryptoJS.AES.encrypt(base64data, this.secretKey).toString();

            const fileName = `${type}_${videoDetails.id}.enc`;

            // 7. Save to Filesystem
            onProgress(100, 'Saving...');
            if (window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.Filesystem) {
                await Capacitor.Plugins.Filesystem.writeFile({
                    path: fileName,
                    data: encrypted,
                    directory: 'CACHE',
                    encoding: 'utf8'
                });
            } else {
                console.warn("Filesystem not available, saving to localStorage");
                localStorage.setItem('file_' + fileName, encrypted);
            }

            // 8. Save Metadata
            const downloads = this.getDownloads();
            downloads.push({
                ...videoDetails,
                fileName: fileName,
                downloadDate: new Date().toISOString(),
                localPath: fileName,
                type: type
            });
            localStorage.setItem(this.downloadsKey, JSON.stringify(downloads));

            // 9. Send Notification
            this.sendNotification(videoDetails.title, type);

            return true;

        } catch (err) {
            console.error("Download process failed:", err);
            throw err;
        }
    }

    blobToBase64(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const result = reader.result;
                const base64 = result.split(',')[1];
                resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }

    async getOfflineVideoUrl(videoId) {
        const downloads = this.getDownloads();
        const item = downloads.find(v => v.id === videoId);
        if (!item) return null;

        try {
            let encryptedData;

            if (window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.Filesystem) {
                const result = await Capacitor.Plugins.Filesystem.readFile({
                    path: item.fileName,
                    directory: 'CACHE',
                    encoding: 'utf8'
                });
                encryptedData = result.data;
            } else {
                encryptedData = localStorage.getItem('file_' + item.fileName);
            }

            if (!encryptedData) throw new Error("File not found in storage");

            const decryptedBase64 = CryptoJS.AES.decrypt(encryptedData, this.secretKey).toString(CryptoJS.enc.Utf8);

            if (!decryptedBase64) {
                throw new Error("Decryption failed");
            }

            const byteCharacters = atob(decryptedBase64);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);

            const mimeType = item.type === 'audio' ? 'audio/mp3' : 'video/mp4';
            const blob = new Blob([byteArray], { type: mimeType });

            return URL.createObjectURL(blob);
        } catch (error) {
            console.error("Error reading offline file:", error);
            return null;
        }
    }

    async removeVideo(videoId) {
        const downloads = this.getDownloads();
        const videoIndex = downloads.findIndex(v => v.id === videoId);

        if (videoIndex !== -1) {
            const video = downloads[videoIndex];
            try {
                if (window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.Filesystem) {
                    await Capacitor.Plugins.Filesystem.deleteFile({
                        path: video.fileName,
                        directory: 'CACHE'
                    });
                } else {
                    localStorage.removeItem('file_' + video.fileName);
                }
            } catch (e) {
                console.warn("File might already be deleted", e);
            }

            downloads.splice(videoIndex, 1);
            localStorage.setItem(this.downloadsKey, JSON.stringify(downloads));
        }
    }

    async cleanupOldVideos() {
        const downloads = this.getDownloads();
        const now = new Date();
        const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

        for (const video of downloads) {
            const downloadDate = new Date(video.downloadDate);
            if (now - downloadDate > thirtyDaysMs) {
                await this.removeVideo(video.id);
            }
        }
    }

    async sendNotification(title, type) {
        if (window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.LocalNotifications) {
            await Capacitor.Plugins.LocalNotifications.schedule({
                notifications: [
                    {
                        title: "Download Complete",
                        body: `${title} (${type}) has been downloaded.`,
                        id: new Date().getTime(),
                        sound: 'notification.mp3',
                        channelId: 'downloads'
                    }
                ]
            });
        } else {
            // Fallback for browser
            new Audio('notification.mp3').play().catch(e => console.log("Audio play blocked", e));
            alert(`Download Complete: ${title}`);
        }
    }
}

const downloadManager = new DownloadManager();