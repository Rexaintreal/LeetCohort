// Toast Notifications
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type} show`;
    
    const icons = {
        success: 'fa-check-circle',
        error: 'fa-exclamation-circle',
        info: 'fa-info-circle'
    };
    
    toast.innerHTML = `
        <div class="flex items-center gap-3">
            <i class="fas ${icons[type]} text-lg"></i>
            <p class="text-sm text-white">${message}</p>
        </div>
    `;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

// Auth
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

function handleLogout() {
    localStorage.removeItem('firebaseToken');
    localStorage.removeItem('userData');
    showToast('Logged out successfully', 'success');
    setTimeout(() => {
        window.location.href = '/';
    }, 500);
}

// APIs
async function fetchLeaderboard(token) {
    try {
        const response = await fetch('/api/leaderboard', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            if (response.status === 401) {
                throw new Error('Session expired. Please login again.');
            }
            throw new Error('Failed to fetch leaderboard');
        }
        
        return await response.json();
    } catch (error) {
        console.error('Error fetching leaderboard:', error);
        throw error;
    }
}

async function fetchUserProfile(uid, token) {
    try {
        const response = await fetch(`/api/profile/${uid}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to fetch user profile');
        }
        
        return await response.json();
    } catch (error) {
        console.error('Error fetching user profile:', error);
        throw error;
    }
}

let allUsers = [];
let filteredUsers = [];
let displayedUsers = [];
let currentUserId = null;
let isLoading = false;
let hasMoreUsers = true;
const USERS_PER_LOAD = 30;

function calculateUserStats(userData, allUsers) {
    const userRank = allUsers.findIndex(u => u.uid === userData.uid) + 1;
    const totalUsers = allUsers.length;
    const percentile = totalUsers > 0 ? Math.round((1 - (userRank / totalUsers)) * 100) : 0;
    const topPercent = totalUsers > 0 ? Math.round((userRank / totalUsers) * 100) : 0;
    
    return { userRank, percentile, topPercent };
}

function updateUserStatsCard(userData, stats) {
    document.getElementById('userRank').textContent = `#${stats.userRank}`;
    document.getElementById('userPercentile').textContent = `${stats.percentile}%`;
    document.getElementById('topPercent').textContent = stats.topPercent;
    document.getElementById('userPoints').textContent = userData.points || 0;
    document.getElementById('userSolved').textContent = userData.problems_solved || 0;
    
    setTimeout(() => {
        document.getElementById('percentileBar').style.width = `${stats.percentile}%`;
    }, 100);
}

function renderLeaderboardItem(user, actualRank, isCurrentUser) {
    const rankColors = {
        0: 'text-yellow-400',
        1: 'text-gray-300',
        2: 'text-orange-400'
    };
    
    const displayRank = actualRank + 1;
    
    const rankIcon = actualRank < 3 
        ? `<i class="fas fa-medal ${rankColors[actualRank]} text-2xl"></i>`
        : `<span class="text-base font-bold text-gray-500">#${displayRank}</span>`;
    
    return `
        <a href="/profile/${user.uid}" class="block">
            <div class="leaderboard-item p-4 ${isCurrentUser ? 'current-user-highlight' : ''}">
                <div class="flex items-center gap-3">
                    <!-- Rank -->
                    <div class="flex items-center justify-center w-12 flex-shrink-0">
                        ${rankIcon}
                    </div>
                    
                    <!-- User Info -->
                    <div class="flex items-center gap-3 flex-1 min-w-0">
                        <img src="${user.picture 
                                ? `/proxy-image?url=${encodeURIComponent(user.picture)}` 
                                : 'https://via.placeholder.com/40'
                            }" 
                            alt="${user.name}"
                            class="h-10 w-10 rounded-full border-2 border-white border-opacity-10 flex-shrink-0"
                            loading="lazy">
                        
                        <div class="flex-1 min-w-0">
                            <div class="flex items-center gap-2">
                                <h3 class="text-sm font-semibold text-white truncate">${user.name}</h3>
                                ${isCurrentUser ? '<span class="text-xs bg-white bg-opacity-10 text-white px-2 py-0.5 rounded-full flex-shrink-0">You</span>' : ''}
                            </div>
                        </div>
                    </div>
                    
                    <!-- Stats -->
                    <div class="flex items-center gap-4 flex-shrink-0">
                        <div class="text-center hidden sm:block">
                            <p class="text-xs text-gray-500">Points</p>
                            <p class="text-sm font-bold text-white">${user.points || 0}</p>
                        </div>
                        
                        <div class="text-center">
                            <p class="text-xs text-gray-500">Solved</p>
                            <p class="text-sm font-bold text-white">${user.problems_solved || 0}</p>
                        </div>
                        
                        <i class="fas fa-chevron-right text-gray-600 text-xs hidden md:block"></i>
                    </div>
                </div>
            </div>
        </a>
    `;
}

function renderLeaderboard(users) {
    const leaderboardList = document.getElementById('leaderboardList');
    
    if (users.length === 0) {
        leaderboardList.innerHTML = `
            <div class="p-12 text-center text-gray-500">
                <i class="fas fa-users text-4xl mb-3 opacity-30"></i>
                <p class="text-sm">No users found</p>
            </div>
        `;
        return;
    }
    
    const html = users.map((user) => {
        const isCurrentUser = user.uid === currentUserId;
        const actualRank = user.globalRank !== undefined ? user.globalRank : allUsers.findIndex(u => u.uid === user.uid);
        return renderLeaderboardItem(user, actualRank, isCurrentUser);
    }).join('');
    
    let footerHTML = '';
    if (isLoading) {
        footerHTML = `
            <div class="p-6 text-center border-t border-white border-opacity-5">
                <div class="inline-block animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-white border-opacity-20"></div>
                <p class="mt-3 text-xs text-gray-500">Loading more...</p>
            </div>
        `;
    } else if (!hasMoreUsers && displayedUsers.length > 0) {
        footerHTML = `
            <div class="p-6 text-center text-gray-500 text-xs border-t border-white border-opacity-5">
                <i class="fas fa-check-circle text-xl mb-2 opacity-30"></i>
                <p>You've reached the end of the leaderboard</p>
            </div>
        `;
    }
    
    leaderboardList.innerHTML = html + footerHTML;
}

function loadMoreUsers() {
    if (isLoading || !hasMoreUsers) return;
    
    const startIndex = displayedUsers.length;
    const endIndex = Math.min(startIndex + USERS_PER_LOAD, filteredUsers.length);
    
    if (startIndex >= filteredUsers.length) {
        hasMoreUsers = false;
        renderLeaderboard(displayedUsers);
        return;
    }
    
    isLoading = true;
    renderLeaderboard(displayedUsers);
    
    setTimeout(() => {
        const newUsers = filteredUsers.slice(startIndex, endIndex);
        displayedUsers = [...displayedUsers, ...newUsers];
        isLoading = false;
        
        if (endIndex >= filteredUsers.length) {
            hasMoreUsers = false;
        }
        renderLeaderboard(displayedUsers);
    }, 300);
}

function filterLeaderboard() {
    const searchTerm = document.getElementById('searchUsers').value.toLowerCase().trim();
    
    if (!searchTerm) {
        filteredUsers = allUsers.map((user, index) => ({
            ...user,
            globalRank: index
        }));
    } else {
        const searchResults = [];
        
        allUsers.forEach((user, originalIndex) => {
            const matchesSearch = user.name.toLowerCase().includes(searchTerm);
            
            if (matchesSearch) {
                searchResults.push({
                    ...user,
                    globalRank: originalIndex
                });
            }
        });
        
        filteredUsers = searchResults;
    }
    
    displayedUsers = [];
    hasMoreUsers = true;
    isLoading = false;
    loadMoreUsers();
}

function setupInfiniteScroll() {
    const leaderboardList = document.getElementById('leaderboardList');
    
    leaderboardList.addEventListener('scroll', () => {
        const scrollTop = leaderboardList.scrollTop;
        const scrollHeight = leaderboardList.scrollHeight;
        const clientHeight = leaderboardList.clientHeight;
        
        if (scrollTop + clientHeight >= scrollHeight - 100) {
            loadMoreUsers();
        }
    });
}

function setupFilters() {
    const searchInput = document.getElementById('searchUsers');
    let searchTimeout;
    searchInput.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            filterLeaderboard();
        }, 300);
    });
}

function updateNavbarProfile(userData) {
    const profilePic = document.getElementById('navProfilePic');
    const profileIcon = document.getElementById('navProfileIcon');
    
    if (userData && userData.picture) {
        profilePic.src = `/proxy-image?url=${encodeURIComponent(userData.picture)}`;
        profilePic.style.display = 'block';
        profileIcon.style.display = 'none';
    } else {
        profilePic.style.display = 'none';
        profileIcon.style.display = 'block';
    }
}

async function initLeaderboardPage() {
    const authData = checkAuth();
    if (!authData) return;
    
    showLoading();
    
    try {
        currentUserId = authData.user.uid;
        
        document.getElementById('profileLink').href = `/profile/${currentUserId}`;
        
        const [leaderboardData, userData] = await Promise.all([
            fetchLeaderboard(authData.token),
            fetchUserProfile(currentUserId, authData.token)
        ]);
        
        allUsers = leaderboardData;
        filteredUsers = allUsers;
        updateNavbarProfile(userData);
        const stats = calculateUserStats(userData, allUsers);
        updateUserStatsCard(userData, stats);
        setupFilters();
        setupInfiniteScroll();
        loadMoreUsers();
        
        showContent();
        showToast('Leaderboard loaded successfully', 'success');
        
    } catch (error) {
        showError(error.message || 'Failed to load leaderboard. Please try again.');
        showToast(error.message || 'Failed to load leaderboard', 'error');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initLeaderboardPage();
    
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }
});