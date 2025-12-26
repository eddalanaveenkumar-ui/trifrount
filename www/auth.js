// Live Backend URL
const API_BASE_URL = "https://triback.onrender.com/api";

// --- Loader Animation ---
function showLoader() {
    if (document.getElementById('loading-overlay')) return;
    const overlay = document.createElement('div');
    overlay.id = 'loading-overlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background-color:rgba(0,0,0,0.7);display:flex;justify-content:center;align-items:center;z-index:9999;';
    const spinner = document.createElement('div');
    spinner.id = 'loading-spinner';
    spinner.style.cssText = 'border:8px solid #f3f3f3;border-top:8px solid #FF0000;border-radius:50%;width:60px;height:60px;animation:spin 1s linear infinite;';
    overlay.appendChild(spinner);
    document.body.appendChild(overlay);
    const style = document.createElement('style');
    if (!document.getElementById('spinner-style')) {
        style.id = 'spinner-style';
        style.innerHTML = `@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`;
        document.head.appendChild(style);
    }
}

function hideLoader() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) overlay.remove();
}

// --- Centralized Session Handler ---
let isHandlingSession = false;

async function handleUserSession(user) {
    if (isHandlingSession) return;
    isHandlingSession = true;

    // Ensure loader is visible while we work
    showLoader();

    try {
        const idToken = await user.getIdToken(true); // Force refresh

        // Add a timeout to the fetch to prevent infinite hanging
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

        const response = await fetch(`${API_BASE_URL}/user/profile`, {
            headers: { 'Authorization': `Bearer ${idToken}` },
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (response.ok) {
            const profile = await response.json();
            // Ensure photo_url is in the profile
            if (!profile.photo_url) {
                profile.photo_url = user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || user.email)}&background=random`;
            }
            localStorage.setItem('userProfile', JSON.stringify(profile));
            window.location.href = 'index.html';
        } else if (response.status === 404) {
            // New user, redirect to onboarding
            window.location.href = 'onboarding.html';
        } else {
            throw new Error(`Server error: ${response.status}`);
        }
    } catch (error) {
        console.error("Session handling error:", error);
        hideLoader();

        let msg = "Could not connect to the server.";
        if (error.name === 'AbortError') {
            msg = "Connection timed out. Please check your internet.";
        } else if (error.message.includes("Server error")) {
            msg = error.message;
        }

        alert(`${msg}\n\nPlease try again.`);
        // We do NOT logout here. The user is authenticated with Firebase.
        // They can click "Continue with Google" again to retry the backend fetch.
    } finally {
        isHandlingSession = false;
        // Note: We don't hide loader on success because the page redirects.
        // We only hide it on error (in the catch block).
    }
}

// --- Main Logic ---
document.addEventListener('DOMContentLoaded', () => {
    // Ensure Firebase is initialized
    if (typeof firebase === 'undefined') {
        console.error("Firebase SDK not loaded.");
        return;
    }

    // Set Persistence
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
            showLoader();
            const state = document.getElementById('userState').value;
            const language = document.getElementById('userLanguage').value;

            if (state && language) {
                const user = firebase.auth().currentUser;
                if (user) {
                    try {
                        const idToken = await user.getIdToken();
                        const photoUrl = user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || user.email)}&background=random`;

                        const response = await fetch(`${API_BASE_URL}/user/profile`, {
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
                            window.location.href = 'index.html';
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
                // User is logged in but on an auth page.
                // This happens after login, or if they revisit login.html while authenticated.
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
    showLoader();
    let email = loginInput;

    if (!loginInput.includes('@')) {
        try {
            const response = await fetch(`${API_BASE_URL}/user/lookup`, {
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

let isGoogleLoginPending = false;
async function googleLogin() {
    if (isGoogleLoginPending) return;
    isGoogleLoginPending = true;
    showLoader();

    const provider = new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });

    try {
        // We await this. If successful, onAuthStateChanged will fire and handle the rest.
        await firebase.auth().signInWithPopup(provider);
    } catch (error) {
        hideLoader(); // Only hide if the popup itself fails/cancels
        console.error("Google Sign-In Error:", error);
        if (error.code !== 'auth/popup-closed-by-user' && error.code !== 'auth/cancelled-popup-request') {
            alert("Google Sign-In failed: " + error.message);
        }
    } finally {
        isGoogleLoginPending = false;
    }
}

function signup(name, username, email, password, confirmPassword) {
    if (password !== confirmPassword) {
        alert("Passwords do not match.");
        return;
    }
    showLoader();
    firebase.auth().createUserWithEmailAndPassword(email, password)
        .then(async (userCredential) => {
            await userCredential.user.updateProfile({ displayName: name });
            const idToken = await userCredential.user.getIdToken();

            const response = await fetch(`${API_BASE_URL}/user/register`, {
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
    showLoader();
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
