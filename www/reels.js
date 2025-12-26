document.addEventListener('DOMContentLoaded', () => {
    const reelsFeed = document.getElementById('reelsFeed');
    const userProfile = JSON.parse(localStorage.getItem('userProfile'));
    let players = [];
    let isFetching = false;
    let intersectionObserver;
    let currentSkip = 0;

    async function fetchShorts(reset = false, initialVideoId = null) {
        if (isFetching) return;
        isFetching = true;

        if (reset) {
            currentSkip = 0;
            if (reelsFeed) reelsFeed.innerHTML = '';
            players = [];
        }

        try {
            const payload = {
                state: userProfile?.state || "india",
                language: userProfile?.language || "telugu",
                limit: 5,
                skip: currentSkip,
                is_short: true
            };

            const response = await fetch(`${API_BASE_URL}/feed`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

            let data = await response.json();

            // If an initial video is specified, prepend it and filter it out from the main data
            if (initialVideoId && reset) {
                const initialVideoResponse = await fetch(`${API_BASE_URL}/video/${initialVideoId}`);
                if (initialVideoResponse.ok) {
                    const initialVideo = await initialVideoResponse.json();
                    data = [initialVideo, ...data.filter(v => v.id !== initialVideoId)];
                }
            }

            if (data && data.length > 0) {
                appendReels(data);
                currentSkip += data.length;
            } else {
                if (intersectionObserver) intersectionObserver.disconnect();
            }
        } catch (error) {
            console.error('Error fetching shorts:', error);
        } finally {
            isFetching = false;
        }
    }

    function appendReels(videos) {
        const sentinel = document.getElementById('sentinel');
        if (!videos || videos.length === 0) return;

        videos.forEach((video) => {
            const reelIndex = players.length;
            const reelItem = document.createElement('div');
            reelItem.className = 'reel-item';
            reelItem.dataset.videoId = video.id;
            reelItem.innerHTML = `
                <div id="reel-player-${reelIndex}" class="reel-player"></div>
                <div class="like-overlay"></div>
                <div class="reel-overlay">
                    <div class="reel-info">
                        <h3 class="reel-username">${video.channel}</h3>
                        <p class="reel-caption">${video.title}</p>
                    </div>
                </div>
                <div class="reel-actions">
                    <button class="reel-action-btn like-btn"><i class="far fa-heart"></i><span>${formatNumber(video.likes)}</span></button>
                    <button class="reel-action-btn"><i class="far fa-comment"></i><span>${formatNumber(video.comment_count)}</span></button>
                    <button class="reel-action-btn"><i class="fas fa-share"></i></button>
                    <button class="reel-action-btn"><i class="fas fa-ellipsis-v"></i></button>
                </div>
            `;

            if (sentinel) {
                reelsFeed.insertBefore(reelItem, sentinel);
            } else {
                reelsFeed.appendChild(reelItem);
            }

            // --- Double Click to Like Logic ---
            const likeOverlay = reelItem.querySelector('.like-overlay');
            const likeBtn = reelItem.querySelector('.like-btn i');

            if (likeOverlay) {
                likeOverlay.addEventListener('dblclick', (e) => {
                    e.preventDefault();
                    // Pass the click coordinates to triggerLike
                    triggerLike(e.clientX, e.clientY, likeBtn);
                });
            }

            if (likeBtn) {
                likeBtn.parentElement.addEventListener('click', () => {
                    toggleLike(likeBtn);
                });
            }

            createPlayer(video.id, reelIndex);
            if (intersectionObserver) {
                intersectionObserver.observe(reelItem);
            }
        });
    }

    function triggerLike(x, y, likeBtn) {
        // 1. Create the heart icon at the click position
        const heart = document.createElement('i');
        heart.className = 'fas fa-heart like-animation-icon';
        heart.style.left = `${x}px`;
        heart.style.top = `${y}px`;
        document.body.appendChild(heart);

        // 2. Animate: Pop in -> Pause -> Fly to button

        // Step 1: Pop In
        heart.animate([
            { opacity: 0, transform: 'translate(-50%, -50%) scale(0.1)' },
            { opacity: 1, transform: 'translate(-50%, -50%) scale(1.2)' },
            { opacity: 1, transform: 'translate(-50%, -50%) scale(1)' }
        ], {
            duration: 400,
            easing: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)', // Bouncy
            fill: 'forwards'
        }).onfinish = () => {
            // Step 2: Fly to button (after a short delay)
            setTimeout(() => {
                if (!likeBtn) {
                    heart.remove();
                    return;
                }

                const btnRect = likeBtn.getBoundingClientRect();
                const heartRect = heart.getBoundingClientRect();

                // Calculate destination (center of the like button)
                const destX = btnRect.left + btnRect.width / 2;
                const destY = btnRect.top + btnRect.height / 2;

                // Calculate current position (center of the heart)
                const startX = heartRect.left + heartRect.width / 2;
                const startY = heartRect.top + heartRect.height / 2;

                // Calculate delta
                const deltaX = destX - startX;
                const deltaY = destY - startY;

                heart.animate([
                    { transform: 'translate(-50%, -50%) scale(1)', opacity: 1 },
                    { transform: `translate(calc(-50% + ${deltaX}px), calc(-50% + ${deltaY}px)) scale(0.2)`, opacity: 0.5 }
                ], {
                    duration: 300, // Faster travel
                    easing: 'ease-in',
                    fill: 'forwards'
                }).onfinish = () => {
                    heart.remove();

                    // 3. Update the like button state to "liked" with a bounce
                    if (!likeBtn.classList.contains('liked')) {
                        likeBtn.classList.remove('far');
                        likeBtn.classList.add('fas', 'liked');
                    } else {
                        // If already liked, just bounce it again
                        likeBtn.classList.remove('liked');
                        void likeBtn.offsetWidth; // Trigger reflow
                        likeBtn.classList.add('liked');
                    }
                };
            }, 300); // Wait 300ms before flying
        };
    }

    function toggleLike(likeBtn) {
        if (likeBtn.classList.contains('liked')) {
            // Unlike
            likeBtn.classList.remove('fas', 'liked');
            likeBtn.classList.add('far');
        } else {
            // Like
            likeBtn.classList.remove('far');
            likeBtn.classList.add('fas', 'liked');
        }
    }

    function createPlayer(videoId, index) {
        try {
            players[index] = new YT.Player(`reel-player-${index}`, {
                height: '100%',
                width: '100%',
                videoId: videoId,
                playerVars: { 'autoplay': 0, 'controls': 0, 'rel': 0, 'loop': 1, 'playlist': videoId, 'mute': 1, 'playsinline': 1 },
                events: {
                    'onReady': (e) => { if (index === 0) e.target.playVideo(); },
                    'onError': (e) => console.error(`Player ${index} error:`, e.data)
                }
            });
        } catch (error) {
            console.error(`Error creating player ${index}:`, error);
        }
    }

    function setupIntersectionObserver() {
        const sentinel = document.createElement('div');
        sentinel.id = 'sentinel';
        reelsFeed.appendChild(sentinel);

        intersectionObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.target.id === 'sentinel') {
                    if (entry.isIntersecting && !isFetching) {
                        fetchShorts();
                    }
                    return;
                }

                const reelPlayer = entry.target.querySelector('.reel-player');
                if (!reelPlayer) return;

                const playerIndex = parseInt(reelPlayer.id.split('-')[2]);
                const player = players[playerIndex];

                if (entry.isIntersecting) {
                    if (player && typeof player.playVideo === 'function') {
                        player.playVideo();
                        player.unMute();
                    }
                } else {
                    if (player && typeof player.pauseVideo === 'function') {
                        player.pauseVideo();
                    }
                }
            });
        }, { threshold: 0.75 });

        document.querySelectorAll('.reel-item').forEach(item => intersectionObserver.observe(item));
        intersectionObserver.observe(sentinel);
    }

    function formatNumber(num) {
        if (!num) return '0';
        num = parseInt(num);
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return num.toString();
    }

    if (!userProfile) {
        window.location.href = 'login.html';
        return;
    }

    loadYouTubeAPI(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const initialVideoId = urlParams.get('videoId');
        fetchShorts(true, initialVideoId);
        setupIntersectionObserver();
    });
});
