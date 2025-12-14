import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth, signInWithPopup, GoogleAuthProvider } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

let app, auth, googleProvider, oauthConfig;

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
        googleProvider = new GoogleAuthProvider();
        
        console.log('Firebase initialized successfully');
    } catch (error) {
        console.error('Failed to initialize Firebase:', error);
        showError('Failed to initialize authentication. Please refresh the page.');
        throw error;
    }
}

// getting OAuth configuration
async function fetchOAuthConfig() {
    try {
        const response = await fetch('/api/oauth-config');
        if (!response.ok) {
            throw new Error('Failed to fetch OAuth configuration');
        }
        oauthConfig = await response.json();
        console.log('OAuth config loaded');
    } catch (error) {
        console.error('Failed to load OAuth config:', error);
        showError('Failed to load authentication configuration.');
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

function setButtonState(buttonId, textId, isLoading, originalText) {
    const button = document.getElementById(buttonId);
    const btnText = document.getElementById(textId);
    
    if (button && btnText) {
        button.disabled = isLoading;
        btnText.textContent = isLoading ? 'Signing in...' : originalText;
    }
}

// Verify stored token
async function verifyStoredToken(token, userData) {
    try {
        const response = await fetch(`/api/user/${userData.uid}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        return response.ok;
    } catch (error) {
        console.error('Token verification failed:', error);
        return false;
    }
}

// Google Sign In
async function handleGoogleSignIn() {
    setButtonState('googleSignInBtn', 'googleBtnText', true, 'Continue with Google');
    hideError();
    
    try {
        const result = await signInWithPopup(auth, googleProvider);
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
        
        window.location.href = '/home';
        
    } catch (error) {
        console.error('Error during Google sign in:', error);
        let errorMessage = 'Failed to sign in with Google. Please try again.';
        
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
        setButtonState('googleSignInBtn', 'googleBtnText', false, 'Continue with Google');
    }
}

// Hack Club Sign In
function handleHackClubSignIn() {
    setButtonState('hackclubSignInBtn', 'hackclubBtnText', true, 'Continue with Hack Club');
    hideError();
    
    try {
        if (!oauthConfig || !oauthConfig.hackclub) {
            throw new Error('Hack Club OAuth not configured');
        }
        
        const { client_id, redirect_uri, authorize_url, scopes } = oauthConfig.hackclub;
        
        const params = new URLSearchParams({
            client_id: client_id,
            redirect_uri: redirect_uri,
            response_type: 'code',
            scope: scopes
        });
        
        window.location.href = `${authorize_url}?${params.toString()}`;
        
    } catch (error) {
        console.error('Error during Hack Club sign in:', error);
        showError('Failed to initiate Hack Club sign in. Please try again.');
        setButtonState('hackclubSignInBtn', 'hackclubBtnText', false, 'Continue with Hack Club');
    }
}

// GitHub Sign In
function handleGitHubSignIn() {
    setButtonState('githubSignInBtn', 'githubBtnText', true, 'Continue with GitHub');
    hideError();
    
    try {
        if (!oauthConfig || !oauthConfig.github) {
            throw new Error('GitHub OAuth not configured');
        }
        
        const { client_id, redirect_uri, authorize_url, scopes } = oauthConfig.github;
        
        const params = new URLSearchParams({
            client_id: client_id,
            redirect_uri: redirect_uri,
            scope: scopes
        });
        
        window.location.href = `${authorize_url}?${params.toString()}`;
        
    } catch (error) {
        console.error('Error during GitHub sign in:', error);
        showError('Failed to initiate GitHub sign in. Please try again.');
        setButtonState('githubSignInBtn', 'githubBtnText', false, 'Continue with GitHub');
    }
}

// OAuth errors in URL
function checkForOAuthError() {
    const urlParams = new URLSearchParams(window.location.search);
    const error = urlParams.get('error');
    
    if (error) {
        const errorMessages = {
            'no_code': 'Authorization code not received.',
            'token_exchange_failed': 'Failed to exchange authorization code.',
            'user_info_failed': 'Failed to retrieve user information.',
            'oauth_failed': 'OAuth authentication failed.'
        };
        
        showError(errorMessages[error] || 'Authentication failed. Please try again.');
        
        window.history.replaceState({}, document.title, '/auth');
    }
}

// Init
async function initAuthPage() {
    try {
        checkForOAuthError();
        
        const token = localStorage.getItem('firebaseToken');
        const userDataStr = localStorage.getItem('userData');
        
        if (token && userDataStr) {
            const userData = JSON.parse(userDataStr);
            const isValid = await verifyStoredToken(token, userData);
            
            if (isValid) {
                window.location.href = '/home';
                return;
            } else {
                console.log('Stored token is invalid, clearing...');
                localStorage.removeItem('firebaseToken');
                localStorage.removeItem('userData');
            }
        }
        
        await initializeFirebase();
        await fetchOAuthConfig();
        
        const googleSignInBtn = document.getElementById('googleSignInBtn');
        const hackclubSignInBtn = document.getElementById('hackclubSignInBtn');
        const githubSignInBtn = document.getElementById('githubSignInBtn');
        
        if (googleSignInBtn) {
            googleSignInBtn.addEventListener('click', handleGoogleSignIn);
        }
        
        if (hackclubSignInBtn) {
            hackclubSignInBtn.addEventListener('click', handleHackClubSignIn);
        }
        
        if (githubSignInBtn) {
            githubSignInBtn.addEventListener('click', handleGitHubSignIn);
        }
    } catch (error) {
        console.error('Failed to initialize auth page:', error);
        showError('Failed to initialize authentication. Please refresh the page.');
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAuthPage);
} else {
    initAuthPage();
}