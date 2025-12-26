document.addEventListener('DOMContentLoaded', () => {
    const historyList = document.getElementById('historyList');
    const removeAllBtn = document.getElementById('removeAllBtn');
    const loggedInUser = JSON.parse(localStorage.getItem('loggedInUser'));

    function loadHistory() {
        if (!historyList || !loggedInUser) return;

        const history = db.getWatchHistory(loggedInUser.id);
        historyList.innerHTML = '';

        if (history.length === 0) {
            historyList.innerHTML = '<p>Your watch history is empty.</p>';
            return;
        }

        history.forEach(item => {
            const historyItem = document.createElement('div');
            historyItem.className = 'history-item';
            historyItem.innerHTML = `
                <div class="history-thumbnail" style="background-image: url('https://i.ytimg.com/vi/${item.video_id}/mqdefault.jpg')"></div>
                <div class="history-info">
                    <div class="title">${item.meta.title}</div>
                    <div class="channel">${item.meta.channel}</div>
                </div>
            `;
            historyItem.addEventListener('click', () => {
                window.location.href = `player.html?videoId=${item.video_id}`;
            });
            historyList.appendChild(historyItem);
        });
    }

    removeAllBtn.addEventListener('click', () => {
        if (loggedInUser) {
            // This is a simulation. In a real app, you'd make a DB call.
            localStorage.removeItem(DB_KEYS.WATCH_HISTORY);
            historyList.innerHTML = '<p>Your watch history has been cleared.</p>';
        }
    });

    loadHistory();
});