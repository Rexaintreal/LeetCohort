// auth
function checkAuth() {
    const token = localStorage.getItem('firebaseToken');
    const userData = localStorage.getItem('userData');
    
    if (!token || !userData) {
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

function updateNavbarProfile(currentUserData, isOwnProfile) {
    const profilePic = document.getElementById('navProfilePic');
    const profileIcon = document.getElementById('navProfileIcon');
    const profileLink = document.getElementById('profileLink');
    
    if (currentUserData && currentUserData.picture) {
        profilePic.src = `/proxy-image?url=${encodeURIComponent(currentUserData.picture)}`;
        profilePic.style.display = 'block';
        profileIcon.style.display = 'none';
    } else {
        profilePic.style.display = 'none';
        profileIcon.style.display = 'block';
    }
    if (currentUserData) {
        profileLink.href = `/profile/${currentUserData.uid}`;
    }
    if (isOwnProfile) {
        profileLink.classList.add('active');
    } else {
        profileLink.classList.remove('active');
    }
}

function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function timeAgo(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);
    
    const intervals = {
        year: 31536000,
        month: 2592000,
        week: 604800,
        day: 86400,
        hour: 3600,
        minute: 60
    };
    
    for (const [unit, secondsInUnit] of Object.entries(intervals)) {
        const interval = Math.floor(seconds / secondsInUnit);
        if (interval >= 1) {
            return `${interval} ${unit}${interval > 1 ? 's' : ''} ago`;
        }
    }
    
    return 'Just now';
}

function updateProfile(data) {
    document.getElementById('profileAvatar').src =
        data.picture
            ? `/proxy-image?url=${encodeURIComponent(data.picture)}`
            : 'https://via.placeholder.com/128';
    document.getElementById('profileName').textContent = data.name;
    document.getElementById('profileEmail').textContent = data.email;
    document.getElementById('profileRank').textContent = `#${data.rank || '-'}`;
    document.getElementById('profilePoints').textContent = data.points || 0;
    document.getElementById('profileSolved').textContent = data.problems_solved || 0;
    
    const stats = data.difficulty_stats || { Easy: 0, Medium: 0, Hard: 0 };
    const totals = data.total_by_difficulty || { Easy: 0, Medium: 0, Hard: 0 };
    ['Easy', 'Medium', 'Hard'].forEach(diff => {
        const solved = stats[diff] || 0;
        const total = totals[diff] || 0;
        const percent = total > 0 ? Math.round((solved / total) * 100) : 0;
        const key = diff.toLowerCase();
        document.getElementById(`${key}Solved`).textContent = `${solved}/${total}`;
        document.getElementById(`${key}Bar`).style.width = `${percent}%`;
        document.getElementById(`${key}Percent`).textContent = `${percent}%`;
    });
    document.getElementById('memberSince').textContent = formatDate(data.created_at);
    document.getElementById('lastActive').textContent = timeAgo(data.last_active);
    createDifficultyChart(stats);
    createProgressChart(stats, totals);
}

function createDifficultyChart(stats) {
    const ctx = document.getElementById('difficultyChart');
    
    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Easy', 'Medium', 'Hard'],
            datasets: [{
                data: [stats.Easy || 0, stats.Medium || 0, stats.Hard || 0],
                backgroundColor: [
                    'rgba(34, 197, 94, 0.8)',
                    'rgba(234, 179, 8, 0.8)',
                    'rgba(239, 68, 68, 0.8)'
                ],
                borderColor: [
                    'rgb(34, 197, 94)',
                    'rgb(234, 179, 8)',
                    'rgb(239, 68, 68)'
                ],
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: '#9CA3AF',
                        padding: 15,
                        font: {
                            size: 12
                        }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    titleColor: '#fff',
                    bodyColor: '#fff',
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    borderWidth: 1,
                    padding: 10,
                    displayColors: false
                }
            }
        }
    });
}

function createProgressChart(solved, totals) {
    const ctx = document.getElementById('progressChart');
    
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Easy', 'Medium', 'Hard'],
            datasets: [
                {
                    label: 'Solved',
                    data: [solved.Easy || 0, solved.Medium || 0, solved.Hard || 0],
                    backgroundColor: [
                        'rgba(34, 197, 94, 0.8)',
                        'rgba(234, 179, 8, 0.8)',
                        'rgba(239, 68, 68, 0.8)'
                    ],
                    borderColor: [
                        'rgb(34, 197, 94)',
                        'rgb(234, 179, 8)',
                        'rgb(239, 68, 68)'
                    ],
                    borderWidth: 2
                },
                {
                    label: 'Remaining',
                    data: [
                        (totals.Easy || 0) - (solved.Easy || 0),
                        (totals.Medium || 0) - (solved.Medium || 0),
                        (totals.Hard || 0) - (solved.Hard || 0)
                    ],
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    borderWidth: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    stacked: true,
                    grid: {
                        color: 'rgba(255, 255, 255, 0.05)'
                    },
                    ticks: {
                        color: '#9CA3AF'
                    }
                },
                y: {
                    stacked: true,
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(255, 255, 255, 0.05)'
                    },
                    ticks: {
                        color: '#9CA3AF',
                        stepSize: 1
                    }
                }
            },
            plugins: {
                legend: {
                    labels: {
                        color: '#9CA3AF',
                        padding: 15,
                        font: {
                            size: 12
                        }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    titleColor: '#fff',
                    bodyColor: '#fff',
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    borderWidth: 1,
                    padding: 10
                }
            }
        }
    });
}

async function fetchProfile(uid) {
    try {
        const response = await fetch(`/api/profile/${uid}`);
        
        if (!response.ok) {
            if (response.status === 404) {
                throw new Error('User not found');
            }
            throw new Error('Failed to load profile');
        }
        
        return await response.json();
    } catch (error) {
        throw error;
    }
}

async function initProfilePage() {
    showLoading();
    
    try {
        const uid = username;
        
        if (!uid) {
            throw new Error('No user ID provided');
        }
        const authData = checkAuth();
        const currentUserData = authData ? authData.user : null;
        const isOwnProfile = currentUserData && currentUserData.uid === uid;
        updateNavbarProfile(currentUserData, isOwnProfile);
        const profileData = await fetchProfile(uid);
        updateProfile(profileData);
        showContent();
        
    } catch (error) {
        showError(error.message || 'Failed to load user profile');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initProfilePage();
    
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }
});