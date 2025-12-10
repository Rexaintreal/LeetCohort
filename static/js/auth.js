import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth, signInWithPopup, GoogleAuthProvider } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

let app, auth, provider;

//firebase init
async function initializeFirebase() {
    try {
        const response = await fetch('/api/firebase-config');
        
        if (!response.ok) {
            throw new Error('Failed to fetch Firebase configuration');
        }
        
        const firebaseConfig = await response.json();
        app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        provider = new GoogleAuthProvider();
        
        console.log('Firebase initialized successfully');
    } catch (error) {
        console.error('Failed to initialize Firebase:', error);
        showError('Failed to initialize authentication. Please refresh the page.');
        throw error;
    }
}

//ui helpers

function showError(message) {
    const errorElement = document.getElementById('errorMessage');
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.classList.add('show');
    }
}

function hideError() {
    const errorElement = document.getElementById('errorMessage');
    if (errorElement) {
        errorElement.classList.remove('show');
    }
}

function setButtonState(isLoading) {
    const signInBtn = document.getElementById('googleSignInBtn');
    const btnText = document.getElementById('btnText');
    
    if (signInBtn && btnText) {
        signInBtn.disabled = isLoading;
        btnText.textContent = isLoading ? 'Signing in...' : 'Continue with Google';
    }
}

//auth

async function handleGoogleSignIn() {
    setButtonState(true);
    hideError();
    try {
        const result = await signInWithPopup(auth, provider);
        const user = result.user;
        const idToken = await user.getIdToken();
        const response = await fetch('/api/auth/verify', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ idToken: idToken })
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Authentication failed');
        }
        const data = await response.json();
        localStorage.setItem('firebaseToken', idToken);
        localStorage.setItem('userData', JSON.stringify(data.user));
        if (data.user.is_new_user) {
            console.log('Welcome new user!');
        } else {
            console.log('Welcome back!');
        }
        window.location.href = '/home';
        
    } catch (error) {
        console.error('Error during sign in:', error);
        let errorMessage = 'Failed to sign in. Please try again.';
        
        if (error.code === 'auth/popup-closed-by-user') {
            errorMessage = 'Sign-in cancelled. Please try again.';
        } else if (error.code === 'auth/popup-blocked') {
            errorMessage = 'Pop-up blocked. Please allow pop-ups for this site.';
        } else if (error.code === 'auth/network-request-failed') {
            errorMessage = 'Network error. Please check your connection.';
        } else if (error.message) {
            errorMessage = error.message;
        }
        
        showError(errorMessage);
        setButtonState(false);
    }
}

//init

async function initAuthPage() {
    try {
        const token = localStorage.getItem('firebaseToken');
        if (token) {
            window.location.href = '/home';
            return;
        }
        await initializeFirebase();
        const signInBtn = document.getElementById('googleSignInBtn');
        if (signInBtn) {
            signInBtn.addEventListener('click', handleGoogleSignIn);
        } else {
            console.error('Sign-in button not found');
        }
    } catch (error) {
        console.error('Failed to initialize auth page:', error);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAuthPage);
} else {
    initAuthPage();
}