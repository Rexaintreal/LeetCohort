//auth check
function checkAuth() {
    const token = localStorage.getItem('firebaseToken');
    const userData = localStorage.getItem('userData');
    
    if (!token || !userData) {
        window.location.href = '/auth';
        return null;
    }
    
    return {
        token: token,
        user: JSON.parse(userData)
    };
}


function showLoading() {
    document.getElementById('loadingState').classList.remove('hidden');
    document.getElementById('mainContent').classList.add('hidden');
    document.getElementById('errorState').classList.add('hidden');
}

function showContent() {
    document.getElementById('loadingState').classList.add('hidden');
    document.getElementById('mainContent').classList.remove('hidden');
    document.getElementById('errorState').classList.add('hidden');
}

function showError(message) {
    document.getElementById('loadingState').classList.add('hidden');
    document.getElementById('mainContent').classList.add('hidden');
    document.getElementById('errorState').classList.remove('hidden');
    document.getElementById('errorMessage').textContent = message;
}

function updateUI(userData) {
    const userName = document.getElementById('userName');
    const userAvatar = document.getElementById('userAvatar');
    const welcomeName = document.getElementById('welcomeName');
    
    if (userName) userName.textContent = userData.name;
    if (welcomeName) welcomeName.textContent = userData.name;
    if (userAvatar) {
        userAvatar.src = userData.picture || 'https://via.placeholder.com/40';
        userAvatar.alt = userData.name;
    }
    
    const problemsSolved = document.getElementById('problemsSolved');
    const totalPoints = document.getElementById('totalPoints');
    
    if (problemsSolved) problemsSolved.textContent = userData.problems_solved;
    if (totalPoints) totalPoints.textContent = userData.points;
}


async function fetchUserData(uid, token) {
    try {
        const response = await fetch(`/api/user/${uid}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            if (response.status === 401) {
                // Token expired or invalid
                throw new Error('Session expired. Please login again.');
            }
            throw new Error('Failed to fetch user data');
        }
        
        const userData = await response.json();
        return userData;
        
    } catch (error) {
        console.error('Error fetching user data:', error);
        throw error;
    }
}

//logout

function handleLogout() {
    localStorage.removeItem('firebaseToken');
    localStorage.removeItem('userData');
    window.location.href = '/';
}

//init

async function initHomePage() {
    const authData = checkAuth();
    if (!authData) return;
    showLoading();
    
    try {
        const userData = await fetchUserData(authData.user.uid, authData.token);
        localStorage.setItem('userData', JSON.stringify(userData));
        updateUI(userData);
        showContent();
        
    } catch (error) {
        showError(error.message || 'Failed to load your dashboard. Please try logging in again.');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initHomePage();
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }
});