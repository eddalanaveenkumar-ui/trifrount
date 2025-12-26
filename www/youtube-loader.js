let isApiReady = false;
const apiReadyCallbacks = [];

// Make this function globally accessible for YouTube API
window.onYouTubeIframeAPIReady = function() {
    console.log('YouTube IFrame API is ready');
    isApiReady = true;
    apiReadyCallbacks.forEach(callback => {
        try {
            callback();
        } catch (error) {
            console.error('Error in API ready callback:', error);
        }
    });
    apiReadyCallbacks.length = 0; // Clear callbacks after execution
};

function loadYouTubeAPI(callback) {
    console.log('loadYouTubeAPI called, isApiReady:', isApiReady);

    if (isApiReady && window.YT && window.YT.Player) {
        console.log('API already ready, executing callback immediately');
        callback();
        return;
    }

    apiReadyCallbacks.push(callback);
    console.log('Callback added, total callbacks:', apiReadyCallbacks.length);

    // Check if API is already loading or loaded
    if (window.YT && window.YT.Player) {
        console.log('YT.Player exists, triggering ready');
        window.onYouTubeIframeAPIReady();
        return;
    }

    // Check if script is already in the page
    const existingScript = document.querySelector('script[src*="youtube.com/iframe_api"]');
    if (existingScript) {
        console.log('YouTube API script already exists');
        return;
    }

    console.log('Loading YouTube API script');
    const tag = document.createElement('script');
    tag.src = "https://www.youtube.com/iframe_api";
    tag.onerror = function() {
        console.error('Failed to load YouTube IFrame API');
    };
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
}