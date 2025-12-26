// Live Backend URL
const API_BASE_URL = "https://triback.onrender.com/api";

// State variables
let isSessionCheckInProgress = false;

// --- Loader Animation ---
function showLoader(message = null) {
    let overlay = document.getElementById('loading-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'loading-overlay';
        overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background-color:rgba(0,0,0,0.7);display:flex;flex-direction:column;justify-content:center;align-items:center;z-index:9999;color:white;font-family:sans-serif;';

        const spinner = document.createElement('div');
        spinner.id = 'loading-spinner';
        spinner.style.cssText = 'border:8px solid #f3f3f3;border-top:8px solid #FF0000;border-radius:50%;width:60px;height:60px;animation:spin 1s linear infinite;margin-bottom:15px;';

        const msgDiv = document.createElement('div');
        msgDiv.id = 'loading-message';
        msgDiv.innerText = message || "Loading...";

        overlay.appendChild(spinner);
        overlay.appendChild(msgDiv);
        document.body.appendChild(overlay);

        const style = document.createElement('style');
        if (!document.getElementById('spinner-style')) {
            style.id = 'spinner-style';
            style.innerHTML = `@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`;
            document.head.appendChild(style);
        }
    } else {
        const msgDiv = document.getElementById('loading-message');
        if (msgDiv && message) msgDiv.innerText = message;
    }
}

function hideLoader() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) overlay.remove();
}

// --- Helper: Fetch with Timeout ---
async function fetchWithTimeout(resource, options = {}) {
    const { timeout = 60000 } = options; // Increased to 60s for Render cold starts

    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);

    try {
        const response = await fetch(resource, {
            ...options,
            signal: controller.signal
        });
        clearTimeout(id);
        return response;
    } catch (error) {
        clearTimeout(id);
        throw error;
    }
}

// --- Centralized Session Handler ---
async function handleUserSession(user) {
    if (isSessionCheckInProgress) {
        console.log("Session check already in progress, skipping.");
        return;
    }
    isSessionCheckInProgress = true;

    console.log("Handling user session for:", user.email);

    // Check local storage first
    if (localStorage.getItem('userProfile')) {
        try {
            const storedProfile = JSON.parse(localStorage.getItem('userProfile'));
            if (storedProfile.email === user.email) {
                 console.log("Valid local profile found, redirecting...");
                 window.location.replace('index.html');
                 return;
            }
        } catch (e) {
            console.error("Error parsing local profile:", e);
            localStorage.removeItem('userProfile');
        }
    }

    showLoader("Connecting to server...");

    const slowConnectionTimeout = setTimeout(() => {
        showLoader("Waking up server... this may take a minute...");
    }, 3000);

    try {
        // DEBUG: Step 1
        // alert("Step 1: Getting ID Token...");

        // Wrap getIdToken in a promise race to prevent hanging
        const idTokenPromise = user.getIdToken(true);
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Token fetch timed out")), 15000));
        const idToken = await Promise.race([idTokenPromise, timeoutPromise]);

        // DEBUG: Step 2
        // alert("Step 2: Got Token. Fetching profile...");

        // 1. Try to get existing profile
        let response;
        try {
            response = await fetchWithTimeout(`${API_BASE_URL}/user/profile`, {
                headers: { 'Authorization': `Bearer ${idToken}` }
            });
        } catch (netError) {
            throw new Error("Network error connecting to profile endpoint: " + netError.message);
        }

        clearTimeout(slowConnectionTimeout);

        if (response.ok) {
            const profile = await response.json();
            localStorage.setItem('userProfile', JSON.stringify(profile));
            // DEBUG: Step 3
            // alert("Step 3: Profile found. Redirecting...");
            window.location.replace('index.html');
        } else {
            // 2. If profile not found, sync with backend
            console.log("Profile not found (Status: " + response.status + "), syncing...");
            showLoader("Creating user profile...");

            let loginResponse;
            try {
                loginResponse = await fetchWithTimeout(`${API_BASE_URL}/user/google-login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id_token: idToken })
                });
            } catch (netError) {
                throw new Error("Network error connecting to login endpoint: " + netError.message);
            }

            if (loginResponse.ok) {
                const backendResponse = await loginResponse.json();
                localStorage.setItem('userProfile', JSON.stringify(backendResponse.profile));
                if (backendResponse.new_user) {
                    window.location.replace('onboarding.html');
                } else {
                    window.location.replace('index.html');
                }
            } else {
                let errorMsg = "Unknown backend error";
                try {
                    const errorData = await loginResponse.json();
                    errorMsg = errorData.detail || errorMsg;
                } catch (e) {
                    errorMsg = "Non-JSON response from server: " + loginResponse.statusText;
                }
                throw new Error(errorMsg);
            }
        }
    } catch (error) {
        clearTimeout(slowConnectionTimeout);
        console.error("Session handling error:", error);
        hideLoader();

        const path = window.location.pathname;
        const page = path.split("/").pop().split("?")[0];

        if (page === 'login.html' || page === 'signup.html') {
             alert("Login failed: " + error.message);
             // Only sign out if it was a fatal error, otherwise user loses their session
             await firebase.auth().signOut();
        }
    } finally {
        isSessionCheckInProgress = false;
    }
}

// --- Main Logic ---
document.addEventListener('DOMContentLoaded', () => {
    if (typeof firebase === 'undefined') {
        console.error("Firebase SDK not loaded.");
        return;
    }

    firebase.auth().useDeviceLanguage();
    firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL)
        .catch((error) => console.error("Error setting persistence:", error));

    // --- Event Listeners ---
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const loginInput = document.getElementById('loginInput').value;
            const password = document.getElementById('loginPassword').value;
            login(loginInput, password);
        });
    }

    const signupForm = document.getElementById('signupForm');
    if (signupForm) {
        signupForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const name = document.getElementById('signupName').value;
            const username = document.getElementById('signupUsername').value;
            const email = document.getElementById('signupEmail').value;
            const password = document.getElementById('signupPassword').value;
            const confirmPassword = document.getElementById('signupConfirmPassword').value;
            signup(name, username, email, password, confirmPassword);
        });
    }

    const googleBtn = document.getElementById('googleSignIn') || document.getElementById('googleSignUp');
    if (googleBtn) {
        googleBtn.addEventListener('click', (e) => {
            e.preventDefault();
            googleLogin();
        });
    }

    const onboardingForm = document.getElementById('onboardingForm');
    if (onboardingForm) {
        onboardingForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            showLoader("Saving...");
            const state = document.getElementById('userState').value;
            const language = document.getElementById('userLanguage').value;

            if (state && language) {
                const user = firebase.auth().currentUser;
                if (user) {
                    try {
                        const idToken = await user.getIdToken();
                        const photoUrl = user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || user.email)}&background=random`;

                        const response = await fetchWithTimeout(`${API_BASE_URL}/user/profile`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
                            body: JSON.stringify({ state, language, photo_url: photoUrl })
                        });

                        if (response.ok) {
                            const userProfile = {
                                userId: user.uid,
                                email: user.email,
                                state,
                                language,
                                photo_url: photoUrl
                            };
                            localStorage.setItem('userProfile', JSON.stringify(userProfile));
                            window.location.replace('index.html');
                        } else {
                            throw new Error((await response.json()).detail || "Failed to save profile");
                        }
                    } catch (error) {
                        console.error("Error saving onboarding data:", error);
                        hideLoader();
                        alert("Failed to save preferences. Please try again.");
                    }
                } else {
                    hideLoader();
                    alert("You must be signed in to save preferences.");
                }
            } else {
                hideLoader();
                alert("Please select both state and language.");
            }
        });
    }

    // --- Auth State Listener ---
    firebase.auth().onAuthStateChanged(async (user) => {
        const path = window.location.pathname;
        let page = path.split("/").pop().split("?")[0] || 'index.html';
        const authPages = ['login.html', 'signup.html', 'verify-email.html'];
        const isAuthPage = authPages.includes(page);

        if (user) {
            if (!user.emailVerified && user.providerData[0].providerId === 'password') {
                if (page !== 'verify-email.html') {
                    localStorage.setItem('pendingEmail', user.email);
                    window.location.href = 'verify-email.html';
                }
                return;
            }

            if (isAuthPage) {
                await handleUserSession(user);
            }
        } else {
            const protectedPages = ['index.html', 'profile.html', 'download.html', 'search.html', 'short.html', 'settings.html', 'long.html', 'onboarding.html', 'chat.html'];
            if (protectedPages.includes(page)) {
                window.location.href = 'login.html';
            }
        }
    });
});

// --- Auth Functions ---

async function login(loginInput, password) {
    showLoader("Logging in...");
    let email = loginInput;

    if (!loginInput.includes('@')) {
        try {
            const response = await fetchWithTimeout(`${API_BASE_URL}/user/lookup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: loginInput })
            });
            if (response.ok) {
                const data = await response.json();
                email = data.email;
            } else {
                throw new Error('User ID not found');
            }
        } catch (error) {
            hideLoader();
            alert("User ID not found. Please check the ID or login with your email.");
            return;
        }
    }

    firebase.auth().signInWithEmailAndPassword(email, password)
        .catch((error) => {
            hideLoader();
            console.error("Login Error:", error);
            alert("Login failed: " + error.message);
        });
}

async function googleLogin() {
    showLoader("Opening Google Sign-In...");

    const provider = new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });

    try {
        const result = await firebase.auth().signInWithPopup(provider);
        // Explicitly call session handler to ensure it runs immediately
        showLoader("Verifying login...");
        await handleUserSession(result.user);
    } catch (error) {
        hideLoader();
        console.error("Google Sign-In Error:", error);

        if (error.code === 'auth/popup-blocked') {
            alert("Popup blocked. Please allow popups for this site.");
        } else if (error.code !== 'auth/popup-closed-by-user' && error.code !== 'auth/cancelled-popup-request') {
            alert("Google Sign-In failed: " + error.message);
        }
    }
}

function signup(name, username, email, password, confirmPassword) {
    if (password !== confirmPassword) {
        alert("Passwords do not match.");
        return;
    }
    showLoader("Creating account...");
    firebase.auth().createUserWithEmailAndPassword(email, password)
        .then(async (userCredential) => {
            await userCredential.user.updateProfile({ displayName: name });
            const idToken = await userCredential.user.getIdToken();

            const response = await fetchWithTimeout(`${API_BASE_URL}/user/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
                body: JSON.stringify({ username, email, display_name: name })
            });

            if (!response.ok) {
                const errorData = await response.json();
                alert(`Signup failed: ${errorData.detail}`);
                await userCredential.user.delete();
                hideLoader();
                throw new Error(errorData.detail);
            }

            await userCredential.user.sendEmailVerification();
            localStorage.setItem('pendingEmail', email);
            window.location.href = 'verify-email.html';
        })
        .catch((error) => {
            hideLoader();
            console.error("Signup Error:", error);
            alert("Signup failed: " + error.message);
        });
}

function logout() {
    showLoader("Signing out...");
    firebase.auth().signOut().then(() => {
        localStorage.clear();
        sessionStorage.clear();
        window.location.href = 'login.html';
    }).catch((error) => {
        hideLoader();
        console.error("An error happened during sign-out:", error);
        localStorage.clear();
        window.location.href = 'login.html';
    });
}

window.logout = logout;