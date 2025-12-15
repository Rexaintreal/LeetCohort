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
    setTimeout(() => toast.remove(), 3000);
}

// Auth
function checkAuth() {
    const token = localStorage.getItem('firebaseToken');
    const userData = localStorage.getItem('userData');
    
    if (!token || !userData) {
        window.location.href = '/auth';
        return null;
    }
    
    return { token, user: JSON.parse(userData) };
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
    setTimeout(() => window.location.href = '/', 500);
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
        if (response.status === 401) throw new Error('Session expired. Please login again.');
        throw new Error('Failed to fetch leaderboard');
    }
    
    return await response.json();
}

async function fetchUserProfile(uid, token) {
    const response = await fetch(`/api/profile/${uid}`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    });
    
    if (!response.ok) throw new Error('Failed to fetch user profile');
    return await response.json();
}

let allUsers = [];
let filteredUsers = [];
let displayedUsers = [];
let currentUserId = null;
let isLoading = false;
let hasMoreUsers = true;
const USERS_PER_LOAD = 30;

function animateValue(element, start, end, duration) {
    const range = end - start;
    const increment = range / (duration / 16);
    let current = start;
    
    const timer = setInterval(() => {
        current += increment;
        if ((increment > 0 && current >= end) || (increment < 0 && current <= end)) {
            current = end;
            clearInterval(timer);
        }
        element.textContent = Math.floor(current);
    }, 16);
}

function calculateUserStats(userData, allUsers) {
    const userRank = allUsers.findIndex(u => u.uid === userData.uid) + 1;
    const totalUsers = allUsers.length;
    const percentile = totalUsers > 0 ? Math.round((1 - (userRank / totalUsers)) * 100) : 0;
    const topPercent = totalUsers > 0 ? Math.round((userRank / totalUsers) * 100) : 0;
    
    return { userRank, percentile, topPercent };
}

function updateUserStatsCard(userData, stats) {
    const rankEl = document.getElementById('userRank');
    rankEl.textContent = `#${stats.userRank}`;
    
    const percentileEl = document.getElementById('userPercentile');
    animateValue(percentileEl, 0, stats.percentile, 1000);
    percentileEl.insertAdjacentHTML('beforeend', '%');
    
    document.getElementById('topPercent').textContent = stats.topPercent;
    
    const pointsEl = document.getElementById('userPoints');
    animateValue(pointsEl, 0, userData.points || 0, 1000);
    const solvedEl = document.getElementById('userSolved');
    animateValue(solvedEl, 0, userData.problems_solved || 0, 1000);
    
    setTimeout(() => {
        document.getElementById('percentileBar').style.width = `${stats.percentile}%`;
    }, 100);
}

function getMedalIcon(rank) {
    const medals = {
        0: '<i class="fas fa-medal text-yellow-400 text-2xl"></i>',
        1: '<i class="fas fa-medal text-gray-300 text-2xl"></i>',
        2: '<i class="fas fa-medal text-orange-400 text-2xl"></i>'
    };
    return medals[rank] || `<span class="text-base font-bold text-gray-500">#${rank + 1}</span>`;
}

function isTopPerformer(rank, problemsSolved, points) {
    return rank < 10 && problemsSolved >= 5 && points >= 50;
}

function renderLeaderboardItem(user, actualRank, isCurrentUser) {
    const displayRank = actualRank + 1;
    const rankIcon = getMedalIcon(actualRank);
    
    const badges = [];
    if (isCurrentUser) {
        badges.push('<span class="status-badge online">You</span>');
    }
    
    if (isTopPerformer(actualRank, user.problems_solved || 0, user.points || 0)) {
        badges.push('<span class="status-badge top-performer">Top Performer</span>');
    }
    
    return `
        <a href="/profile/${user.uid}" class="block" data-rank="${displayRank}">
            <div class="leaderboard-item p-4 ${isCurrentUser ? 'current-user-highlight' : ''}">
                <div class="flex items-center gap-3">
                    <div class="rank-display flex items-center justify-center flex-shrink-0">
                        ${rankIcon}
                    </div>
                    
                    <div class="flex items-center gap-3 flex-1 min-w-0">
                        <img src="${user.picture || '/static/assets/hcavatar.png'}" 
                            alt="${user.name}"
                            class="h-10 w-10 rounded-full flex-shrink-0"
                            onerror="this.onerror=null; this.src='/static/assets/hcavatar.png';"
                            loading="lazy">
                        
                        <div class="flex-1 min-w-0">
                            <div class="flex items-center gap-2 mb-1">
                                <h3 class="text-sm font-semibold text-white truncate">${user.name}</h3>
                                ${badges.join('')}
                            </div>
                            <div class="flex items-center gap-2 text-xs text-gray-500">
                                <span>${user.problems_solved || 0} problems</span>
                                ${actualRank < 10 ? '<span class="text-primary">• Top 10</span>' : ''}
                            </div>
                        </div>
                    </div>
                    
                    <div class="flex items-center gap-4 flex-shrink-0">
                        <div class="text-center hidden sm:block">
                            <p class="text-xs text-gray-500 mb-1">Points</p>
                            <p class="text-sm font-bold text-white">${user.points || 0}</p>
                        </div>
                        
                        <div class="text-center">
                            <p class="text-xs text-gray-500 mb-1">Solved</p>
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
            <div class="empty-state">
                <i class="fas fa-users text-gray-500"></i>
                <p class="text-sm text-gray-400">No users found</p>
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
                <div class="inline-block animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-primary"></div>
                <p class="mt-3 text-xs text-gray-500">Loading more...</p>
            </div>
        `;
    } else if (!hasMoreUsers && displayedUsers.length > 0) {
        footerHTML = `
            <div class="p-6 text-center text-gray-500 text-xs border-t border-white border-opacity-5">
                <i class="fas fa-check-circle text-xl mb-2 text-green-500"></i>
                <p>You've reached the end</p>
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
        const searchResults = allUsers
            .map((user, originalIndex) => ({
                ...user,
                globalRank: originalIndex
            }))
            .filter(user => 
                user.name.toLowerCase().includes(searchTerm) ||
                user.email.toLowerCase().includes(searchTerm)
            );
        
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
    
    if (userData.picture) {
        profilePic.src = userData.picture;
        profilePic.onerror = function() {
            this.onerror = function() {
                this.style.display = 'none';
                profileIcon.style.display = 'block';
            };
            this.src = '/static/assets/hcavatar.png';
        };
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