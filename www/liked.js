document.addEventListener('DOMContentLoaded', () => {
    const likedList = document.getElementById('likedList');
    const loggedInUser = JSON.parse(localStorage.getItem('loggedInUser'));

    if (loggedInUser) {
        const videos = db.getLikedVideos(loggedInUser.id);
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
                likedList.appendChild(item);
            });
        } else {
            likedList.innerHTML = '<p>You haven\\'t liked any videos yet.</p>';
        }
    }
});