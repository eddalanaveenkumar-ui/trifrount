const AUDIO_TYPES = {
    DIALOGUE: 'dialogue',
    BGM: 'bgm',
    FUNNY: 'funny',
    EMOTIONAL: 'emotional',
    ANIME: 'anime',
    LOFI: 'lofi'
};

const FEED_LOOP = ['INTEREST', 'DOPAMINE', 'SOFT', 'INTEREST'];

const feedEngine = {
    async getInitialFeed(userProfile) {
        // PART 1 — USER TESTING SEQUENCE (FIRST SESSION)
        // Exact Test Sequence (Order Matters)

        const sequence = [
            { type: AUDIO_TYPES.DIALOGUE, q: `emotional movie dialogue ${userProfile.language}` },
            { type: AUDIO_TYPES.BGM, q: `mass bgm hype ${userProfile.language}` },
            { type: AUDIO_TYPES.FUNNY, q: `funny meme audio ${userProfile.language}` },
            { type: AUDIO_TYPES.EMOTIONAL, q: `sad romantic music ${userProfile.language}` },
            { type: AUDIO_TYPES.ANIME, q: 'anime opening fight sound' },
            { type: AUDIO_TYPES.LOFI, q: 'lofi aesthetic calm music' }
        ];

        const promises = sequence.map(item => this.search(item.q, userProfile.region, 1));
        const results = await Promise.all(promises);

        let feed = [];
        results.forEach((videos, index) => {
            if (videos.length > 0) {
                feed.push({ ...videos[0], audioType: sequence[index].type });
            }
        });

        // We need 8-10 shorts, so we'll add placeholders for the repeat test
        // These will be filled dynamically based on early interactions or just more variety for now
        // For the initial fetch, let's just add a couple more random ones from the sequence to reach 8
        const extraPromises = [
            this.search(`trending shorts ${userProfile.region}`, userProfile.region, 1),
            this.search(`viral shorts ${userProfile.language}`, userProfile.region, 1)
        ];
        const extraResults = await Promise.all(extraPromises);
        extraResults.forEach(videos => {
             if (videos.length > 0) {
                feed.push({ ...videos[0], audioType: 'trending' }); // Placeholder type
            }
        });

        return feed;
    },

    async getPersonalizedFeed(userProfile, feedState) {
        // PART 2 — FEEDING SHORTS AFTER TEST (MAIN FEED)
        // Daily Behavior: Keep interests, change videos, test 5-10% new

        const primaryInterest = feedState.primaryInterest;
        const interests = feedState.interests;

        if (!primaryInterest) {
            return this.getInitialFeed(userProfile);
        }

        let feed = [];
        const loopCount = 3; // Generate 3 loops worth of content (12 videos)

        for (let i = 0; i < loopCount; i++) {
            // Rotation Rule for Multi-Interest
            // Interest A -> Dopamine -> Soft -> Interest B -> Dopamine -> Soft -> Interest A

            const sortedInterests = Object.keys(interests).sort((a, b) => interests[b] - interests[a]);
            const currentInterest = sortedInterests[i % sortedInterests.length] || primaryInterest;

            // 1. Interest Short
            const interestVideos = await this.search(`${currentInterest} ${userProfile.language}`, userProfile.region, 1);
            if (interestVideos.length > 0) feed.push({ ...interestVideos[0], audioType: currentInterest });

            // 2. Dopamine Short
            const dopamineVideos = await this.search(`funny hype action ${userProfile.language}`, userProfile.region, 1);
            if (dopamineVideos.length > 0) feed.push({ ...dopamineVideos[0], audioType: AUDIO_TYPES.FUNNY });

            // 3. Soft Short
            const softVideos = await this.search(`calm emotional aesthetic ${userProfile.language}`, userProfile.region, 1);
            if (softVideos.length > 0) feed.push({ ...softVideos[0], audioType: AUDIO_TYPES.LOFI });

            // 4. Interest Short (Variation)
            const interestVideos2 = await this.search(`${currentInterest} ${userProfile.language} new`, userProfile.region, 1);
            if (interestVideos2.length > 0) feed.push({ ...interestVideos2[0], audioType: currentInterest });
        }

        // Test 5-10% new content (1 video in this batch)
        const testVideo = await this.search(`trending new ${userProfile.region}`, userProfile.region, 1);
        if (testVideo.length > 0) feed.push({ ...testVideo[0], audioType: 'test' });

        return feed;
    },

    trackBehavior(videoId, behavior, feedState) {
        const video = feedState.feed.find(v => v.id === videoId);
        if (!video) return;

        let interests = feedState.interests;
        const audioType = video.audioType;

        // 🧠 WHAT YOU TRACK
        // Pause >= 1 second -> +1 interest
        // Full watch -> +2 interest
        // Replay -> LOCK interest

        if (behavior === 'pause') {
            interests[audioType] = (interests[audioType] || 0) + 1;
        } else if (behavior === 'full_watch') {
            interests[audioType] = (interests[audioType] || 0) + 2;
        } else if (behavior === 'replay') {
            interests[audioType] = (interests[audioType] || 0) + 5; // High score to effectively lock
            feedState.primaryInterest = audioType; // Immediate lock
        }

        // Determine primary interest if not locked
        if (!feedState.primaryInterest) {
            const sorted = Object.entries(interests).sort(([,a], [,b]) => b - a);
            if (sorted.length > 0 && sorted[0][1] >= 3) { // Threshold to set primary
                feedState.primaryInterest = sorted[0][0];
            }
        }

        localStorage.setItem('feedState', JSON.stringify(feedState));
    },

    async constructNextReel(feedState) {
        // 🔁 PERFECT FEED LOOP (CORE ENGINE)
        // Interest -> Dopamine -> Soft -> Interest

        const lastReelType = feedState.lastReelType || 'INTEREST'; // Default start
        let nextReelType;

        const currentIndex = FEED_LOOP.indexOf(lastReelType);
        if (currentIndex === -1) {
             nextReelType = 'INTEREST';
        } else {
             nextReelType = FEED_LOOP[(currentIndex + 1) % FEED_LOOP.length];
        }

        let query;
        let targetAudioType;

        if (nextReelType === 'INTEREST') {
            // Handle Multi-Interest Rotation
            const interests = feedState.interests;
            const sortedInterests = Object.keys(interests).sort((a, b) => interests[b] - interests[a]);
            // Simple rotation logic: pick random from top 3 or primary
            const targetInterest = sortedInterests.length > 0 ? sortedInterests[Math.floor(Math.random() * Math.min(sortedInterests.length, 3))] : feedState.primaryInterest;

            query = `${targetInterest} ${feedState.userProfile.language}`;
            targetAudioType = targetInterest;
        } else if (nextReelType === 'DOPAMINE') {
            query = `funny hype action ${feedState.userProfile.language}`;
            targetAudioType = AUDIO_TYPES.FUNNY;
        } else { // SOFT
            query = `calm emotional aesthetic ${feedState.userProfile.language}`;
            targetAudioType = AUDIO_TYPES.LOFI;
        }

        const results = await this.search(query, feedState.userProfile.region, 1);

        // Fallback if search fails
        if (results.length === 0) {
             const trending = await this.search(`trending ${feedState.userProfile.region}`, feedState.userProfile.region, 1);
             if (trending.length > 0) {
                 const nextVideo = trending[0];
                 nextVideo.audioType = 'trending';
                 feedState.lastReelType = nextReelType; // Still advance the loop state
                 feedState.feed.push(nextVideo);
                 localStorage.setItem('feedState', JSON.stringify(feedState));
                 return nextVideo;
             }
             return null;
        }

        const nextVideo = results[0];
        nextVideo.audioType = targetAudioType;

        feedState.lastReelType = nextReelType;
        feedState.feed.push(nextVideo);
        localStorage.setItem('feedState', JSON.stringify(feedState));

        return nextVideo;
    },

    async search(query, region, count) {
        const apiKey = getApiKey();
        // 1. Search for videos
        const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${query}&type=video&videoDuration=short&maxResults=${count}&regionCode=${region}&key=${apiKey}`;
        const searchResponse = await fetch(searchUrl);
        const searchData = await searchResponse.json();

        if (!searchData.items || searchData.items.length === 0) return [];

        const videoIds = searchData.items.map(item => item.id.videoId).join(',');

        // 2. Fetch statistics for these videos
        const statsUrl = `https://www.googleapis.com/youtube/v3/videos?part=statistics,snippet&id=${videoIds}&key=${apiKey}`;
        const statsResponse = await fetch(statsUrl);
        const statsData = await statsResponse.json();

        return statsData.items.map(item => ({
            id: item.id,
            title: item.snippet.title,
            channel: item.snippet.channelTitle,
            likeCount: item.statistics.likeCount,
            commentCount: item.statistics.commentCount
        }));
    },

    shuffle(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }
};

window.feedEngine = feedEngine;