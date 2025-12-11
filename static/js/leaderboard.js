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
    window.location.href = '/';
}

// APIs
async function fetchLeaderboard(token) {
    const response = await fetch('/api/leaderboard', {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    });
    
    if (!response.ok) {
        throw new Error('Failed to fetch leaderboard');
    }
    
    return await response.json();
}

async function fetchUserProfile(uid) {
    const response = await fetch(`/api/profile/${uid}`);
    
    if (!response.ok) {
        throw new Error('Failed to fetch user profile');
    }
    
    return await response.json();
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
    document.getElementById('progressText').textContent = `Top ${stats.topPercent}% of all users`;
    
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
        ? `<i class="fas fa-medal ${rankColors[actualRank]} text-3xl"></i>`
        : `<span class="text-xl font-bold text-gray-500">#${displayRank}</span>`;
    
    return `
        <a href="/profile/${user.uid}" class="block">
            <div class="leaderboard-item p-6 ${isCurrentUser ? 'current-user-highlight' : ''}">
                <div class="flex items-center gap-8">
                    <!-- Rank -->
                    <div class="flex items-center justify-center w-20 flex-shrink-0">
                        ${rankIcon}
                    </div>
                    
                    <!-- User Info -->
                    <div class="flex items-center gap-5 flex-1 min-w-0">
                        <img src="${user.picture 
                                ? `/proxy-image?url=${encodeURIComponent(user.picture)}` 
                                : 'https://via.placeholder.com/64'
                            }" 
                            alt="${user.name}"
                            class="h-16 w-16 rounded-full border-2 border-white border-opacity-10 flex-shrink-0">
                        
                        <div class="flex-1 min-w-0">
                            <h3 class="text-lg font-semibold text-white truncate flex items-center gap-2">
                                ${user.name}
                                ${isCurrentUser ? '<span class="text-xs bg-purple-500 bg-opacity-20 text-purple-400 px-2 py-1 rounded-full border border-purple-500 border-opacity-30">You</span>' : ''}
                            </h3>
                            <p class="text-sm text-gray-400 truncate">${user.email}</p>
                        </div>
                    </div>
                    
                    <!-- Stats -->
                    <div class="flex items-center gap-10 flex-shrink-0">
                        <div class="text-center">
                            <p class="text-xs text-gray-500 mb-1">Points</p>
                            <p class="text-xl font-bold text-white">${user.points || 0}</p>
                        </div>
                        
                        <div class="text-center">
                            <p class="text-xs text-gray-500 mb-1">Solved</p>
                            <p class="text-xl font-bold text-white">${user.problems_solved || 0}</p>
                        </div>
                        
                        <i class="fas fa-chevron-right text-gray-600"></i>
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
            <div class="p-16 text-center text-gray-500">
                <i class="fas fa-users text-5xl mb-4 opacity-30"></i>
                <p class="text-lg">No users found</p>
            </div>
        `;
        return;
    }
    
    const html = users.map((user) => {
        const isCurrentUser = user.uid === currentUserId;
        const actualRank = user.globalRank !== undefined ? user.globalRank : allUsers.findIndex(u => u.uid === user.uid);
        return renderLeaderboardItem(user, actualRank, isCurrentUser);
    }).join('');
    
    leaderboardList.innerHTML = html;
}

function loadMoreUsers() {
    if (isLoading || !hasMoreUsers) return;
    
    const startIndex = displayedUsers.length;
    const endIndex = Math.min(startIndex + USERS_PER_LOAD, filteredUsers.length);
    
    if (startIndex >= filteredUsers.length) {
        hasMoreUsers = false;
        document.getElementById('endOfList').classList.remove('hidden');
        return;
    }
    
    isLoading = true;
    document.getElementById('loadingMore').classList.remove('hidden');
    
    setTimeout(() => {
        const newUsers = filteredUsers.slice(startIndex, endIndex);
        displayedUsers = [...displayedUsers, ...newUsers];
        renderLeaderboard(displayedUsers);
        isLoading = false;
        document.getElementById('loadingMore').classList.add('hidden');
        
        if (endIndex >= filteredUsers.length) {
            hasMoreUsers = false;
            document.getElementById('endOfList').classList.remove('hidden');
        }
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
            const matchesSearch = 
                user.name.toLowerCase().includes(searchTerm) || 
                user.email.toLowerCase().includes(searchTerm);
            
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
    document.getElementById('endOfList').classList.add('hidden');
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
    
    if (userData.picture) {
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
            fetchUserProfile(currentUserId)
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
        
    } catch (error) {
        showError(error.message || 'Failed to load leaderboard. Please try again.');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initLeaderboardPage();
    
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }
});