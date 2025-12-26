document.addEventListener('DOMContentLoaded', () => {
    const videosGrid = document.getElementById('videosGrid');
    const storiesTray = document.getElementById('storiesTray');
    const appHeader = document.getElementById('appHeader');
    let players = {};
    let isFetching = false;
    let currentSkip = 0;
    let intersectionObserver;
    let globalMuteState = true; // Default to muted
    let scrollTimeout;
    let currentActiveVideoId = null; // Track the currently active video ID
    let lastScrollTop = 0; // For scroll direction detection

    // --- Optimization Constants ---
    const BATCH_SIZE = 10;
    const MAX_VIDEOS_IN_DOM = 15;
    const PRELOAD_THRESHOLD = 7; // Fetch next batch when user reaches 7th video of current batch

    // --- Volume Button Listeners ---
    let volumeUpPressStartTime = 0;
    let volumeDownPressStartTime = 0;
    const LONG_PRESS_UNMUTE_DURATION = 500; // 0.5 seconds
    const LONG_PRESS_MUTE_DURATION = 500; // 0.5 seconds

    function setupVolumeButtonListeners() {
        // Listen for the custom event dispatched from Android native code
        document.addEventListener('volumeButton', (e) => {
            const { direction, state } = e.detail;
            const now = Date.now();

            if (direction === 'up') {
                if (state === 'down') {
                    if (volumeUpPressStartTime === 0) {
                        volumeUpPressStartTime = now;
                    }
                } else if (state === 'up') {
                    const duration = now - volumeUpPressStartTime;
                    if (duration >= LONG_PRESS_UNMUTE_DURATION) {
                        // Long press Volume Up -> Unmute All
                        globalMuteState = false;
                        applyGlobalMuteState();
                        showToast("All videos unmuted");
                    }
                    volumeUpPressStartTime = 0; // Reset
                }
            } else if (direction === 'down') {
                if (state === 'down') {
                    if (volumeDownPressStartTime === 0) {
                        volumeDownPressStartTime = now;
                    }
                } else if (state === 'up') {
                    const duration = now - volumeDownPressStartTime;
                    if (duration >= LONG_PRESS_MUTE_DURATION) {
                        // Long press Volume Down -> Mute All
                        globalMuteState = true;
                        applyGlobalMuteState();
                        showToast("All videos muted");
                    }
                    volumeDownPressStartTime = 0; // Reset
                }
            }
        });
    }

    function showToast(message) {
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed;
            bottom: 80px;
            left: 50%;
            transform: translateX(-50%);
            background-color: rgba(0,0,0,0.8);
            color: white;
            padding: 10px 20px;
            border-radius: 20px;
            z-index: 10000;
            font-size: 14px;
            transition: opacity 0.3s;
        `;
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 2000);
    }

    function formatNumber(num) {
        if (!num) return '0';
        num = parseInt(num);
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return num.toString();
    }

    // --- Stories Logic ---
    function loadStories() {
        if (!storiesTray) return;

        // Update current user avatar if available
        const userProfile = JSON.parse(localStorage.getItem('userProfile'));
        const currentUserAvatar = document.getElementById('currentUserStoryAvatar');
        if (userProfile && userProfile.photo_url && currentUserAvatar) {
            currentUserAvatar.src = userProfile.photo_url;
        }

        // Mock stories data (replace with API call later)
        const mockStories = [
            { username: 'alex_d', avatar: 'https://i.pravatar.cc/150?u=alex' },
            { username: 'sarah_j', avatar: 'https://i.pravatar.cc/150?u=sarah' },
            { username: 'mike_t', avatar: 'https://i.pravatar.cc/150?u=mike' },
            { username: 'emily_r', avatar: 'https://i.pravatar.cc/150?u=emily' },
            { username: 'david_k', avatar: 'https://i.pravatar.cc/150?u=david' },
            { username: 'lisa_m', avatar: 'https://i.pravatar.cc/150?u=lisa' }
        ];

        mockStories.forEach(story => {
            const storyItem = document.createElement('div');
            storyItem.className = 'story-item';
            storyItem.innerHTML = `
                <div class="story-ring">
                    <img src="${story.avatar}" class="story-avatar" alt="${story.username}">
                </div>
                <span class="story-username">${story.username}</span>
            `;
            storiesTray.appendChild(storyItem);
        });
    }

    function appendVideos(videos) {
        if (!videosGrid) return;

        videos.forEach(video => {
            const videoId = video.video_id;
            const videoCard = document.createElement('div');
            videoCard.className = 'video-card';
            videoCard.dataset.videoId = videoId;

            // Ensure profile pic has a fallback
            const profilePic = video.profile_pic || `https://ui-avatars.com/api/?name=${encodeURIComponent(video.channel_name)}&background=random`;

            // Determine aspect ratio class based on is_short flag
            const mediaClass = video.is_short ? 'post-media short-video' : 'post-media';

            // Construct the HTML based on the new structure
            videoCard.innerHTML = `
                <!-- 1. Header Zone -->
                <div class="post-header">
                    <img class="post-avatar" src="${profilePic}" alt="${video.channel_name}">
                    <div class="post-info">
                        <span class="post-username">${video.channel_name}</span>
                        <span class="post-location">Bangalore, India</span>
                    </div>
                    <button class="post-options"><i class="fas fa-ellipsis-v"></i></button>
                </div>

                <!-- 2. Media Zone -->
                <div class="${mediaClass}">
                    <div class="player-wrapper" id="player-container-${videoId}"></div>
                    <div class="like-overlay"></div> <!-- Transparent overlay for double-click -->
                    <div class="mute-icon" id="mute-btn-${videoId}">
                        <i class="fas ${globalMuteState ? 'fa-volume-mute' : 'fa-volume-up'}"></i>
                    </div>
                </div>

                <!-- 3. Action Zone -->
                <div class="post-actions">
                    <div class="post-actions-left">
                        <i class="far fa-heart" id="like-btn-${videoId}"></i>
                        <i class="far fa-comment"></i>
                        <i class="far fa-paper-plane"></i>
                    </div>
                    <div class="post-actions-right">
                        <i class="far fa-bookmark"></i>
                    </div>
                </div>

                <!-- 4. Meta Zone -->
                <div class="post-meta">
                    <div class="post-likes">Liked by ${formatNumber(video.likes)} and others</div>
                    <div class="post-caption">
                        <span class="post-username-caption">${video.channel_name}</span>
                        ${video.title}
                    </div>
                    <div class="post-time">2 HOURS AGO</div>
                </div>
            `;
            videosGrid.appendChild(videoCard);
            intersectionObserver.observe(videoCard);

            // Add mute toggle listener
            const muteBtn = videoCard.querySelector(`#mute-btn-${videoId}`);
            if (muteBtn) {
                muteBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    toggleGlobalMute();
                });
            }

            // --- Double Click to Like Logic ---
            const likeOverlay = videoCard.querySelector('.like-overlay');
            const likeBtn = videoCard.querySelector(`#like-btn-${videoId}`);
            const mediaContainer = videoCard.querySelector('.post-media');

            if (likeOverlay) {
                likeOverlay.addEventListener('dblclick', (e) => {
                    e.preventDefault(); // Prevent default zoom or other actions
                    // Pass the container to calculate center
                    triggerLike(mediaContainer, likeBtn);
                });
            }

            if (likeBtn) {
                likeBtn.addEventListener('click', () => {
                    toggleLike(likeBtn);
                });
            }
        });

        // Trigger a check after appending to play the first video if needed
        setTimeout(checkActiveVideo, 500);

        // Memory Cleanup: Remove old videos if we exceed the limit
        cleanupOldVideos();
    }

    function triggerLike(container, likeBtn) {
        // Calculate center of the container
        const rect = container.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;

        // 1. Create the heart icon at the center position
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
                    duration: 300, // Faster travel (reduced from 500ms)
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

    function cleanupOldVideos() {
        const cards = Array.from(document.querySelectorAll('.video-card'));
        if (cards.length > MAX_VIDEOS_IN_DOM) {
            cards.forEach(card => {
                const videoId = card.dataset.videoId;
                const rect = card.getBoundingClientRect();
                const isFarAway = Math.abs(rect.top) > 4000;

                if (isFarAway && players[videoId]) {
                    if (typeof players[videoId].destroy === 'function') {
                        players[videoId].destroy();
                    }
                    delete players[videoId];
                }
            });
        }
    }

    function toggleGlobalMute() {
        globalMuteState = !globalMuteState;
        applyGlobalMuteState();
    }

    function applyGlobalMuteState() {
        // Update all existing players
        Object.keys(players).forEach(vidId => {
            const player = players[vidId];
            const muteBtn = document.getElementById(`mute-btn-${vidId}`);

            if (player && typeof player.mute === 'function') {
                if (globalMuteState) {
                    player.mute();
                } else {
                    player.unMute();
                }
            }

            if (muteBtn) {
                muteBtn.innerHTML = `<i class="fas ${globalMuteState ? 'fa-volume-mute' : 'fa-volume-up'}"></i>`;
            }
        });
    }

    function createPlayer(videoId) {
        if (players[videoId]) return; // Player already exists

        const container = document.getElementById(`player-container-${videoId}`);
        if (!container) return;

        players[videoId] = new YT.Player(container, {
            height: '100%',
            width: '100%',
            videoId: videoId,
            playerVars: {
                'autoplay': 0, // We handle autoplay manually
                'controls': 0,
                'rel': 0,
                'loop': 1,
                'playlist': videoId,
                'mute': 1, // Start muted to allow autoplay
                'playsinline': 1,
                'modestbranding': 1,
                'showinfo': 0,
                'disablekb': 1,
                'fs': 0,
                'origin': window.location.origin
            },
            events: {
                'onReady': (e) => {
                    // PRE-BUFFERING STRATEGY:
                    // Always mute and play initially to force the browser to download video segments.
                    e.target.mute();
                    e.target.playVideo();

                    // Update icon
                    const muteBtn = document.getElementById(`mute-btn-${videoId}`);
                    if (muteBtn) {
                        muteBtn.innerHTML = `<i class="fas ${globalMuteState ? 'fa-volume-mute' : 'fa-volume-up'}"></i>`;
                    }
                },
                'onStateChange': (e) => {
                    // When video starts playing (buffer complete)
                    if (e.data === YT.PlayerState.PLAYING) {
                        // If this is NOT the active video, pause it immediately.
                        // It is now "primed" and ready to play instantly when scrolled to.
                        if (videoId !== currentActiveVideoId) {
                            e.target.pauseVideo();
                        } else {
                            // It IS the active video. Ensure audio is correct.
                            if (!globalMuteState) e.target.unMute();
                        }
                    }

                    // Loop logic
                    if (e.data === YT.PlayerState.ENDED) {
                        e.target.playVideo();
                    }
                },
                'onError': (e) => {
                    console.error(`Player error for ${videoId}:`, e.data);
                    if (e.data === 100 || e.data === 101 || e.data === 150) {
                        const card = container.closest('.video-card');
                        if (card) card.style.display = 'none';
                    }
                }
            }
        });
    }

    // New logic: Find the most central video and play it, pause others
    function checkActiveVideo() {
        if (!videosGrid) return;

        const viewHeight = videosGrid.clientHeight;
        const viewTop = videosGrid.scrollTop;
        const viewCenter = viewTop + (viewHeight / 2);

        let closestCard = null;
        let minDistance = Infinity;

        const cards = document.querySelectorAll('.video-card');
        const allCards = Array.from(cards);

        cards.forEach(card => {
            // Calculate center of the card relative to the grid container
            const cardTop = card.offsetTop;
            const cardHeight = card.offsetHeight;
            const cardCenter = cardTop + (cardHeight / 2);

            const distance = Math.abs(viewCenter - cardCenter);

            if (distance < minDistance) {
                minDistance = distance;
                closestCard = card;
            }
        });

        if (closestCard) {
            const activeVideoId = closestCard.dataset.videoId;
            currentActiveVideoId = activeVideoId; // Update global active ID

            // Play the closest video
            const activePlayer = players[activeVideoId];
            if (activePlayer && typeof activePlayer.playVideo === 'function') {
                // Only play if not already playing
                if (activePlayer.getPlayerState() !== YT.PlayerState.PLAYING) {
                    activePlayer.playVideo();
                    // Audio sync handled in onStateChange or here
                    if (!globalMuteState) activePlayer.unMute();
                }
            } else if (!activePlayer) {
                createPlayer(activeVideoId);
            }

            // Pause all other videos ONLY if they are currently playing
            // We don't want to interrupt buffering (state 3) of upcoming videos
            Object.keys(players).forEach(videoId => {
                if (videoId !== activeVideoId) {
                    const player = players[videoId];
                    if (player && typeof player.getPlayerState === 'function') {
                        const state = player.getPlayerState();
                        if (state === YT.PlayerState.PLAYING) {
                            player.pauseVideo();
                        }
                    }
                }
            });

            // --- AGGRESSIVE PRELOADING ---
            // Force create players for the next 2 videos to ensure they are ready (0 buffering)
            const currentIndex = allCards.indexOf(closestCard);
            for (let i = 1; i <= 2; i++) {
                const nextCard = allCards[currentIndex + i];
                if (nextCard) {
                    const nextId = nextCard.dataset.videoId;
                    if (!players[nextId]) {
                        createPlayer(nextId);
                    }
                }
            }

            // Check if we need to preload next batch
            const remainingCards = allCards.length - (currentIndex + 1);
            if (remainingCards <= (BATCH_SIZE - PRELOAD_THRESHOLD) && !isFetching) {
                console.log(`Reaching end of feed (${remainingCards} left), preloading next batch...`);
                loadVideos();
            }
        }
    }

    function setupIntersectionObserver() {
        // Increased rootMargin to 800px (approx 1.5 screens) to initialize players much earlier
        intersectionObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                const videoId = entry.target.dataset.videoId;
                if (entry.isIntersecting) {
                    // Create player if it doesn't exist yet
                    if (!players[videoId]) {
                        createPlayer(videoId);
                    }
                }
            });
        }, { rootMargin: '800px 0px', threshold: 0.01 });
    }

    async function loadVideos(isInitialLoad = false) {
        if (isFetching) return;
        isFetching = true;

        const limit = isInitialLoad ? BATCH_SIZE : BATCH_SIZE;

        try {
            const userProfile = JSON.parse(localStorage.getItem('userProfile'));
            const payload = {
                state: userProfile?.state || "india",
                language: userProfile?.language || "telugu",
                limit: limit,
                skip: currentSkip
            };

            // Use the API_BASE_URL from auth.js if available, otherwise fallback
            const baseUrl = (typeof API_BASE_URL !== 'undefined') ? API_BASE_URL : "https://backend-bwwq.onrender.com/api";

            const response = await fetch(`${baseUrl}/feed`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

            const data = await response.json();

            if (data && data.length > 0) {
                appendVideos(data);
                currentSkip += data.length;
            } else {
                if (intersectionObserver) intersectionObserver.disconnect();
            }
        } catch (error) {
            console.error('Error fetching videos:', error);
        } finally {
            isFetching = false;
        }
    }

    function setupScrollListener() {
        videosGrid.addEventListener('scroll', () => {
            const scrollTop = videosGrid.scrollTop;

            // --- Header Hide/Show Logic ---
            if (scrollTop > lastScrollTop && scrollTop > 50) {
                // Scrolling DOWN -> Hide Header
                if (appHeader) appHeader.classList.add('hidden');
            } else {
                // Scrolling UP -> Show Header
                if (appHeader) appHeader.classList.remove('hidden');
            }
            lastScrollTop = scrollTop;

            // 1. Infinite Scroll Logic (Legacy check, kept as backup)
            if (videosGrid.scrollTop + videosGrid.clientHeight >= videosGrid.scrollHeight - 500) {
                loadVideos();
            }

            // 2. Auto-Play Logic (Throttled)
            clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(() => {
                checkActiveVideo();
                // Also trigger cleanup on scroll stop
                cleanupOldVideos();
            }, 50); // Reduced to 50ms for faster response
        });
    }

    // Initial Load
    if (videosGrid) {
        // Ensure YouTube API is loaded before trying to create players
        if (window.YT && window.YT.Player) {
             setupVolumeButtonListeners(); // Setup volume listeners
             loadStories();
             setupIntersectionObserver();
             loadVideos(true);
             setupScrollListener();
        } else {
            loadYouTubeAPI(() => {
                setupVolumeButtonListeners(); // Setup volume listeners
                loadStories(); // Load stories first
                setupIntersectionObserver();
                loadVideos(true); // Initial load
                setupScrollListener();
            });
        }
    }
});
