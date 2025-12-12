// toast

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
    showToast('Logged out successfully', 'success');
    setTimeout(() => {
        window.location.href = '/';
    }, 500);
}

function updateNavbarProfile(currentUserData, isOwnProfile) {
    const profilePic = document.getElementById('navProfilePic');
    const profileIcon = document.getElementById('navProfileIcon');
    const profileLink = document.getElementById('profileLink');
    
    if (currentUserData && currentUserData.picture) {
        profilePic.src = currentUserData.picture;
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
    document.getElementById('profileAvatar').src = data.picture || 'https://via.placeholder.com/128';
    document.getElementById('profileName').textContent = data.name;
    document.getElementById('profileEmail').style.display = 'none';
    document.getElementById('profileRank').textContent = `#${data.rank || '-'}`;
    document.getElementById('profilePoints').textContent = data.points || 0;
    document.getElementById('profileSolved').textContent = data.problems_solved || 0;
    
    const stats = data.difficulty_stats || { Easy: 0, Medium: 0, Hard: 0 };
    const totals = data.total_by_difficulty || { Easy: 0, Medium: 0, Hard: 0 };
    setTimeout(() => {
        ['Easy', 'Medium', 'Hard'].forEach(diff => {
            const solved = stats[diff] || 0;
            const total = totals[diff] || 0;
            const percent = total > 0 ? Math.round((solved / total) * 100) : 0;
            const key = diff.toLowerCase();
            
            document.getElementById(`${key}Solved`).textContent = `${solved}/${total}`;
            document.getElementById(`${key}Bar`).style.width = `${percent}%`;
            document.getElementById(`${key}Percent`).textContent = `${percent}%`;
        });
    }, 200);
    
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
                borderWidth: 2,
                hoverOffset: 10
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                animateRotate: true,
                animateScale: true,
                duration: 1000,
                easing: 'easeInOutQuart'
            },
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: '#9CA3AF',
                        padding: 15,
                        font: {
                            size: 12,
                            weight: 500
                        },
                        usePointStyle: true,
                        pointStyle: 'circle'
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.9)',
                    titleColor: '#fff',
                    bodyColor: '#fff',
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    borderWidth: 1,
                    padding: 12,
                    displayColors: false,
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.parsed || 0;
                            return `${label}: ${value} problems`;
                        }
                    }
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
                    borderWidth: 2,
                    borderRadius: 6
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
                    borderWidth: 1,
                    borderRadius: 6
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 1000,
                easing: 'easeInOutQuart'
            },
            scales: {
                x: {
                    stacked: true,
                    grid: {
                        color: 'rgba(255, 255, 255, 0.05)',
                        drawBorder: false
                    },
                    ticks: {
                        color: '#9CA3AF',
                        font: {
                            size: 12,
                            weight: 500
                        }
                    }
                },
                y: {
                    stacked: true,
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(255, 255, 255, 0.05)',
                        drawBorder: false
                    },
                    ticks: {
                        color: '#9CA3AF',
                        stepSize: 1,
                        font: {
                            size: 12
                        }
                    }
                }
            },
            plugins: {
                legend: {
                    labels: {
                        color: '#9CA3AF',
                        padding: 15,
                        font: {
                            size: 12,
                            weight: 500
                        },
                        usePointStyle: true,
                        pointStyle: 'circle'
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.9)',
                    titleColor: '#fff',
                    bodyColor: '#fff',
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    borderWidth: 1,
                    padding: 12,
                    callbacks: {
                        label: function(context) {
                            const label = context.dataset.label || '';
                            const value = context.parsed.y || 0;
                            return `${label}: ${value}`;
                        }
                    }
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
        console.error('Profile initialization error:', error);
        showError(error.message || 'Failed to load user profile');
        showToast(error.message || 'Failed to load profile', 'error');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initProfilePage();
    
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }
});