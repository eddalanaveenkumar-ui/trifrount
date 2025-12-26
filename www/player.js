document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const videoId = urlParams.get('videoId');
    if (!videoId) return;

    let currentVideoDetails = {};
    let watchTimeInterval;
    let hasEnded = false;

    const youtubePlayer = document.getElementById('youtube-player');
    youtubePlayer.src = `https://www.youtube.com/embed/${videoId}?enablejsapi=1&autoplay=1`;

    var player;
    window.onYouTubeIframeAPIReady = function() {
        player = new YT.Player('youtube-player', {
            events: {
                'onStateChange': onPlayerStateChange
            }
        });
    }

    function onPlayerStateChange(event) {
        if (event.data == YT.PlayerState.PLAYING) {
            startWatchTimeTracker();
            if (hasEnded) {
                logReplay(videoId);
                hasEnded = false;
            }
        } else if (event.data == YT.PlayerState.PAUSED) {
            stopWatchTimeTracker();
            const currentTime = player.getCurrentTime();
            logPause(videoId, currentTime);
        } else if (event.data == YT.PlayerState.ENDED) {
            stopWatchTimeTracker();
            hasEnded = true;
        } else {
            stopWatchTimeTracker();
        }
    }

    var tag = document.createElement('script');
    tag.src = "https://www.youtube.com/iframe_api";
    var firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

    function startWatchTimeTracker() {
        if (watchTimeInterval) return;
        watchTimeInterval = setInterval(() => {
            logWatchTime(videoId, 10);
        }, 10000);
    }

    function stopWatchTimeTracker() {
        clearInterval(watchTimeInterval);
        watchTimeInterval = null;
    }

    async function fetchVideoDetails() {
        try {
            const response = await fetch(`${API_BASE_URL}/video/${videoId}`);
            if (!response.ok) {
                throw new Error(`Failed to fetch video details: ${response.status}`);
            }
            const video = await response.json();
            currentVideoDetails = video;
            updateUIWithVideoDetails(currentVideoDetails);
        } catch (error) {
            console.error('Error fetching video details:', error);
            document.getElementById('video-title').textContent = "Error loading video details.";
        }
    }

    function updateUIWithVideoDetails(video) {
        document.getElementById('video-title').textContent = video.title;
        document.getElementById('channel-title').textContent = video.channel;
        // You would need to add these elements to your player.html if they don't exist
        // document.getElementById('video-description').textContent = video.description;
        // document.getElementById('like-count').textContent = formatNumber(video.likes);
    }

    function formatNumber(num) {
        return new Intl.NumberFormat('en-US', { notation: 'compact', compactDisplay: 'short' }).format(num);
    }

    // Capacitor App back button handling
    if (window.Capacitor && window.Capacitor.isPluginAvailable('App')) {
        const { App } = window.Capacitor.Plugins;
        App.addListener('backButton', ({ canGoBack }) => {
            if (canGoBack) {
                window.history.back();
            } else {
                window.location.href = 'index.html';
            }
        });
    }

    fetchVideoDetails();
});
