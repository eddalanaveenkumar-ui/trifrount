// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDtIMnGM7eiFeATKw03sEjC68qQAQ_LJt0",
  authDomain: "triangle-e1a45.firebaseapp.com",
  projectId: "triangle-e1a45",
  storageBucket: "triangle-e1a45.firebasestorage.app",
  messagingSenderId: "315544385144",
  appId: "1:315544385144:web:218d64111cc4dacc645f8d",
  measurementId: "G-NKZ2BYGBTJ"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const googleProvider = new firebase.auth.GoogleAuthProvider();

// YouTube API Key
function getApiKey() {
    // Replace with your actual YouTube Data API v3 key
    return "AIzaSyDtIMnGM7eiFeATKw03sEjC68qQAQ_LJt0";
}
