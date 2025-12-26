document.addEventListener('DOMContentLoaded', () => {
    const savedList = document.getElementById('savedList');
    const loggedInUser = JSON.parse(localStorage.getItem('loggedInUser'));

    if (loggedInUser) {
        const videos = db.getSavedVideos(loggedInUser.id);
        if (videos.length > 0) {
            videos.forEach(video => {
                const item = document.createElement('div');
                item.className = 'history-item';
                item.innerHTML = `
                    <div class="history-thumbnail" style="background-image: url('https://i.ytimg.com/vi/${video.video_id}/mqdefault.jpg')"></div>
                    <div class="history-info">
                        <div class="title">${video.meta.title}</div>
                        <div class="channel">${video.meta.channel}</div>
                    </div>
                `;
                item.addEventListener('click', () => {
                    window.location.href = `player.html?videoId=${video.video_id}`;
                });
                savedList.appendChild(item);
            });
        } else {
            savedList.innerHTML = '<p>You haven\\'t saved any videos yet.</p>';
        }
    }
});