document.addEventListener('DOMContentLoaded', () => {
    const chatListContainer = document.getElementById('chatList');

    // --- Mock Data (Replace with API calls) ---
    const getChats = () => {
        // Return an empty array to test the fallback states
        return [];
        // return [
        //     { username: 'alex_d', avatar: 'https://i.pravatar.cc/150?u=alex', lastMessage: 'Hey, how are you?', timestamp: '2h' },
        //     { username: 'sarah_j', avatar: 'https://i.pravatar.cc/150?u=sarah', lastMessage: 'See you tomorrow!', timestamp: '1d' }
        // ];
    };

    const getFollowing = () => {
        // Return an empty array to test the final fallback
        return [];
        // return [
        //     { username: 'mike_t', avatar: 'https://i.pravatar.cc/150?u=mike' },
        //     { username: 'emily_r', avatar: 'https://i.pravatar.cc/150?u=emily' }
        // ];
    };

    // --- Render Functions ---
    function renderChats(chats) {
        chatListContainer.innerHTML = '';
        chats.forEach(chat => {
            const chatItem = document.createElement('div');
            chatItem.className = 'chat-item';
            chatItem.innerHTML = `
                <img src="${chat.avatar}" alt="User" class="chat-avatar">
                <div class="chat-details">
                    <div class="chat-username">${chat.username}</div>
                    <div class="chat-last-message">${chat.lastMessage}</div>
                </div>
                <div class="chat-timestamp">${chat.timestamp}</div>
            `;
            chatListContainer.appendChild(chatItem);
        });
    }

    function renderFollowing(following) {
        chatListContainer.innerHTML = `
            <div class="following-list">
                <h3>Start a chat with people you follow</h3>
            </div>
        `;
        const followingList = chatListContainer.querySelector('.following-list');
        following.forEach(user => {
            const followingItem = document.createElement('div');
            followingItem.className = 'following-item';
            followingItem.innerHTML = `
                <div class="following-info">
                    <img src="${user.avatar}" alt="User" class="following-avatar">
                    <span class="following-username">${user.username}</span>
                </div>
                <button class="chat-btn">Chat</button>
            `;
            followingList.appendChild(followingItem);
        });
    }

    function renderInviteFriends() {
        chatListContainer.innerHTML = `
            <div class="empty-state-container">
                <i class="fas fa-user-plus"></i>
                <h3>Invite your friends to chat</h3>
                <p>Share the app with your friends to start a conversation.</p>
                <a href="https://triangleweb.netlify.app/" class="invite-link">Get App Link</a>
            </div>
        `;
    }

    // --- Main Logic ---
    const chats = getChats();
    if (chats.length > 0) {
        renderChats(chats);
    } else {
        const following = getFollowing();
        if (following.length > 0) {
            renderFollowing(following);
        } else {
            renderInviteFriends();
        }
    }
});
