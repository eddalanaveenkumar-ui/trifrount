// Simulated SQL Database using localStorage

const DB_KEYS = {
    USERS: 'sql_users',
    SEARCH_HISTORY: 'sql_search_history',
    WATCH_HISTORY: 'sql_watch_history',
    WATCH_TIME: 'sql_watch_time',
    LIKED_VIDEOS: 'sql_liked_videos',
    SAVED_VIDEOS: 'sql_saved_videos',
    METADATA: 'sql_metadata'
};

const db = {
    // ... (Previous user and history operations remain the same) ...
    // User Operations
    createUser: (username, email, password) => {
        const users = JSON.parse(localStorage.getItem(DB_KEYS.USERS)) || [];
        if (users.some(u => u.email === email)) {
            return { success: false, message: 'Email already exists' };
        }
        const newUser = {
            id: Date.now(),
            username,
            email,
            password, // In a real app, this should be hashed
            created_at: new Date().toISOString()
        };
        users.push(newUser);
        localStorage.setItem(DB_KEYS.USERS, JSON.stringify(users));
        return { success: true, user: newUser };
    },

    getUserByEmail: (email) => {
        const users = JSON.parse(localStorage.getItem(DB_KEYS.USERS)) || [];
        return users.find(u => u.email === email);
    },

    getUserByIdentifier: (identifier) => {
        const users = JSON.parse(localStorage.getItem(DB_KEYS.USERS)) || [];
        return users.find(u => u.email === identifier || u.username === identifier);
    },

    // Search History Operations
    addSearchHistory: (userId, query) => {
        const history = JSON.parse(localStorage.getItem(DB_KEYS.SEARCH_HISTORY)) || [];
        const newEntry = {
            id: Date.now(),
            user_id: userId,
            query,
            timestamp: new Date().toISOString()
        };
        history.unshift(newEntry);
        localStorage.setItem(DB_KEYS.SEARCH_HISTORY, JSON.stringify(history));
    },

    getSearchHistory: (userId) => {
        const history = JSON.parse(localStorage.getItem(DB_KEYS.SEARCH_HISTORY)) || [];
        return history.filter(h => h.user_id === userId).slice(0, 10);
    },

    // Watch History Operations
    addWatchHistory: (userId, videoId, videoMeta) => {
        const history = JSON.parse(localStorage.getItem(DB_KEYS.WATCH_HISTORY)) || [];
        const filteredHistory = history.filter(h => !(h.user_id === userId && h.video_id === videoId));
        const newEntry = {
            id: Date.now(),
            user_id: userId,
            video_id: videoId,
            meta: videoMeta,
            timestamp: new Date().toISOString()
        };
        filteredHistory.unshift(newEntry);
        localStorage.setItem(DB_KEYS.WATCH_HISTORY, JSON.stringify(filteredHistory));
    },

    getWatchHistory: (userId) => {
        const history = JSON.parse(localStorage.getItem(DB_KEYS.WATCH_HISTORY)) || [];
        return history.filter(h => h.user_id === userId);
    },

    // Watch Time Operations
    logWatchTime: (userId, seconds) => {
        const watchTime = JSON.parse(localStorage.getItem(DB_KEYS.WATCH_TIME)) || [];
        const today = new Date().toISOString().split('T')[0];
        const todayEntry = watchTime.find(e => e.user_id === userId && e.date === today);

        if (todayEntry) {
            todayEntry.seconds += seconds;
        } else {
            watchTime.push({ user_id: userId, date: today, seconds: seconds });
        }
        localStorage.setItem(DB_KEYS.WATCH_TIME, JSON.stringify(watchTime));
    },

    getWatchTimeLastWeek: (userId) => {
        const watchTime = JSON.parse(localStorage.getItem(DB_KEYS.WATCH_TIME)) || [];
        const lastWeek = new Date();
        lastWeek.setDate(lastWeek.getDate() - 7);
        return watchTime.filter(e => e.user_id === userId && new Date(e.date) >= lastWeek);
    },

    // Liked Videos Operations
    toggleLikeVideo: (userId, videoId, videoMeta) => {
        let likedVideos = JSON.parse(localStorage.getItem(DB_KEYS.LIKED_VIDEOS)) || [];
        const existingIndex = likedVideos.findIndex(v => v.user_id === userId && v.video_id === videoId);

        if (existingIndex > -1) {
            likedVideos.splice(existingIndex, 1); // Unlike
            localStorage.setItem(DB_KEYS.LIKED_VIDEOS, JSON.stringify(likedVideos));
            return false;
        } else {
            likedVideos.unshift({
                id: Date.now(),
                user_id: userId,
                video_id: videoId,
                meta: videoMeta,
                timestamp: new Date().toISOString()
            }); // Like
            localStorage.setItem(DB_KEYS.LIKED_VIDEOS, JSON.stringify(likedVideos));
            return true;
        }
    },

    getLikedVideos: (userId) => {
        const likedVideos = JSON.parse(localStorage.getItem(DB_KEYS.LIKED_VIDEOS)) || [];
        return likedVideos.filter(v => v.user_id === userId);
    },

    isLiked: (userId, videoId) => {
        const likedVideos = JSON.parse(localStorage.getItem(DB_KEYS.LIKED_VIDEOS)) || [];
        return likedVideos.some(v => v.user_id === userId && v.video_id === videoId);
    },

    // Saved Videos Operations
    toggleSaveVideo: (userId, videoId, videoMeta) => {
        let savedVideos = JSON.parse(localStorage.getItem(DB_KEYS.SAVED_VIDEOS)) || [];
        const existingIndex = savedVideos.findIndex(v => v.user_id === userId && v.video_id === videoId);

        if (existingIndex > -1) {
            savedVideos.splice(existingIndex, 1); // Unsave
            localStorage.setItem(DB_KEYS.SAVED_VIDEOS, JSON.stringify(savedVideos));
            return false;
        } else {
            savedVideos.unshift({
                id: Date.now(),
                user_id: userId,
                video_id: videoId,
                meta: videoMeta,
                timestamp: new Date().toISOString()
            }); // Save
            localStorage.setItem(DB_KEYS.SAVED_VIDEOS, JSON.stringify(savedVideos));
            return true;
        }
    },

    getSavedVideos: (userId) => {
        const savedVideos = JSON.parse(localStorage.getItem(DB_KEYS.SAVED_VIDEOS)) || [];
        return savedVideos.filter(v => v.user_id === userId);
    },

    isSaved: (userId, videoId) => {
        const savedVideos = JSON.parse(localStorage.getItem(DB_KEYS.SAVED_VIDEOS)) || [];
        return savedVideos.some(v => v.user_id === userId && v.video_id === videoId);
    },

    // Metadata Tracking (Likes, Watches, Pauses)
    trackMetadata: (videoId, action) => {
        let metadata = JSON.parse(localStorage.getItem(DB_KEYS.METADATA)) || {};
        if (!metadata[videoId]) {
            metadata[videoId] = { likes: 0, watches: 0, pauses: 0 };
        }

        if (action === 'like') metadata[videoId].likes++;
        if (action === 'watch') metadata[videoId].watches++;
        if (action === 'pause') metadata[videoId].pauses++;

        localStorage.setItem(DB_KEYS.METADATA, JSON.stringify(metadata));
    }
};

window.db = db;