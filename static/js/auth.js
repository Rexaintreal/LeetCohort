import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth, signInWithPopup, GoogleAuthProvider } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

let app, auth, provider;

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

async function handleGoogleSignIn() {
    setButtonState(true);
    hideError();

    try {
        const result = await signInWithPopup(auth, provider);
        const user = result.user;
        const idToken = await user.getIdToken();
        const response = await fetch('/auth/verify', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ idToken: idToken })
        });

        if (response.ok) {
            window.location.href = '/home';
        } else {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Authentication failed');
        }
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


async function initAuthPage() {
    try {
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