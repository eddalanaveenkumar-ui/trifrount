// This file would handle fetching and displaying recommended videos.
// For demonstration purposes, it uses the local videoDatabase.
// In a real application, this would make an API call.

// Load environment variables from .env
const API_KEY = process.env.API_KEY;

document.addEventListener('DOMContentLoaded', function() {
    const urlParams = new URLSearchParams(window.location.search);
    const currentVideoId = parseInt(urlParams.get('videoId'));

    const recommendationsGrid = document.getElementById('recommendationsGrid');
    if (recommendationsGrid) {
        // Clear existing recommendations
        recommendationsGrid.innerHTML = '';

        // In a real app, you would fetch recommendations from an API
        // using the API_KEY. For now, we'll use the local database.
        videoDatabase.longVideos.forEach(recommendedVideo => {
            if (recommendedVideo.id !== currentVideoId) {
                const card = createRecommendationCard(recommendedVideo);
                recommendationsGrid.appendChild(card);
            }
        });
    }
});

function createRecommendationCard(video) {
    const card = document.createElement('div');
    card.className = 'video-card';
    card.dataset.id = video.id;
    card.innerHTML = `
        <div class="card-thumbnail">
            <div class="card-duration">${video.duration}</div>
        </div>
        <div class="card-content">
            <div class="card-info">
                <div class="card-title">${video.title}</div>
                <div class="card-channel">${video.channel}</div>
                <div class="card-stats">
                    <span>${video.views} views</span>
                    <span>•</span>
                    <span>${video.timeAgo}</span>
                </div>
            </div>
        </div>
    `;

    card.addEventListener('click', () => {
        window.location.href = `long.html?videoId=${video.id}`;
    });

    return card;
}
