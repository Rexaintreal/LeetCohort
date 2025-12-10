// auth
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
// profile card
function updateUserProfile(userData, rank) {
    const userName = document.getElementById('userName');
    const userEmail = document.getElementById('userEmail');
    const userAvatar = document.getElementById('userAvatar');
    const userPoints = document.getElementById('userPoints');
    const userSolved = document.getElementById('userSolved');
    const userRank = document.getElementById('userRank');
    
    if (userName) userName.textContent = userData.name;
    if (userEmail) userEmail.textContent = userData.email;
    if (userAvatar) {
        userAvatar.src = userData.picture || 'https://via.placeholder.com/96';
        userAvatar.alt = userData.name;
    }
    if (userPoints) userPoints.textContent = userData.points || 0;
    if (userSolved) userSolved.textContent = userData.problems_solved || 0;
    if (userRank) userRank.textContent = rank ? `#${rank}` : '-';
}

function updateProgressBars(problems, solvedProblems) {
    const difficulties = { Easy: 0, Medium: 0, Hard: 0 };
    const solved = { Easy: 0, Medium: 0, Hard: 0 };
    
    problems.forEach(p => {
        difficulties[p.difficulty]++;
        if (solvedProblems.includes(p.id)) {
            solved[p.difficulty]++;
        }
    });
    
    ['Easy', 'Medium', 'Hard'].forEach(diff => {
        const total = difficulties[diff] || 0;
        const count = solved[diff] || 0;
        const percent = total > 0 ? (count / total * 100) : 0;
        
        const progressEl = document.getElementById(`${diff.toLowerCase()}Progress`);
        const barEl = document.getElementById(`${diff.toLowerCase()}Bar`);
        
        if (progressEl) progressEl.textContent = `${count}/${total}`;
        if (barEl) barEl.style.width = `${percent}%`;
    });
}

//questions
function renderProblems(problems, solvedProblems = []) {
    const problemsList = document.getElementById('problemsList');
    if (!problemsList) return;
    
    if (problems.length === 0) {
        problemsList.innerHTML = `
            <div class="p-8 text-center text-gray-400">
                <i class="fas fa-inbox text-4xl mb-3"></i>
                <p>No problems found</p>
            </div>
        `;
        return;
    }
    
    problemsList.innerHTML = problems.map(problem => {
        const isSolved = solvedProblems.includes(problem.id);
        const difficultyColors = {
            'Easy': 'text-green-400',
            'Medium': 'text-yellow-400',
            'Hard': 'text-red-400'
        };
        return `
            <div class="p-4 hover:bg-gray-800 transition cursor-pointer problem-item" data-difficulty="${problem.difficulty}">
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-4 flex-1">
                        <div class="flex items-center justify-center w-8">
                            ${isSolved ? '<i class="fas fa-check-circle text-primary text-lg"></i>' : '<i class="far fa-circle text-gray-600 text-lg"></i>'}
                        </div>
                        <div class="flex-1">
                            <h3 class="font-medium text-white mb-1">${problem.title}</h3>
                            <p class="text-sm text-gray-400 line-clamp-1">${problem.description.substring(0, 100)}...</p>
                        </div>
                    </div>
                    <div class="flex items-center gap-4">
                        <span class="text-sm font-medium ${difficultyColors[problem.difficulty]}">${problem.difficulty}</span>
                        <i class="fas fa-chevron-right text-gray-600"></i>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// leaderboard
function renderLeaderboard(leaderboard, currentUserId) {
    const leaderboardList = document.getElementById('leaderboardList');
    if (!leaderboardList) return;
    
    if (leaderboard.length === 0) {
        leaderboardList.innerHTML = `
            <div class="text-center text-gray-400 py-8">
                <i class="fas fa-users text-3xl mb-2"></i>
                <p class="text-sm">No users yet</p>
            </div>
        `;
        return;
    }
    
    leaderboardList.innerHTML = leaderboard.map((user, index) => {
        const isCurrentUser = user.uid === currentUserId;
        const rankColors = {
            0: 'text-yellow-400',
            1: 'text-gray-300',
            2: 'text-orange-400'
        };
        
        return `
            <div class="flex items-center gap-3 p-3 rounded-lg ${isCurrentUser ? 'bg-primary bg-opacity-10 border border-primary' : 'hover:bg-gray-800'} transition">
                <div class="flex items-center justify-center w-8 font-bold ${rankColors[index] || 'text-gray-500'}">
                    ${index < 3 ? '<i class="fas fa-medal"></i>' : `#${index + 1}`}
                </div>
                <img src="${user.picture || 'https://via.placeholder.com/32'}" alt="${user.name}" class="h-8 w-8 rounded-full border border-gray-700">
                <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium truncate ${isCurrentUser ? 'text-primary' : 'text-white'}">${user.name}</p>
                    <p class="text-xs text-gray-400">${user.problems_solved} solved</p>
                </div>
                <div class="text-sm font-bold text-primary">${user.points}</div>
            </div>
        `;
    }).join('');
}

//funcs
async function fetchUserData(uid, token) {
    const response = await fetch(`/api/user/${uid}`, {
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
        throw new Error('Failed to fetch user data');
    }
    
    return await response.json();
}

async function fetchProblems(token) {
    const response = await fetch('/api/problems', {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    });
    
    if (!response.ok) {
        throw new Error('Failed to fetch problems');
    }
    
    return await response.json();
}

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

let allProblems = [];
let currentFilter = 'all';


function filterProblems() {
    const searchTerm = document.getElementById('searchProblems').value.toLowerCase();
    const authData = checkAuth();
    const solvedProblems = authData.user.solved_problems || [];
    
    let filtered = allProblems;
    
    if (currentFilter !== 'all') {
        filtered = filtered.filter(p => p.difficulty === currentFilter);
    }
    if (searchTerm) {
        filtered = filtered.filter(p => 
            p.title.toLowerCase().includes(searchTerm) || 
            p.description.toLowerCase().includes(searchTerm)
        );
    }
    renderProblems(filtered, solvedProblems);
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
        const [userData, problemsData, leaderboardData] = await Promise.all([
            fetchUserData(authData.user.uid, authData.token),
            fetchProblems(authData.token),
            fetchLeaderboard(authData.token)
        ]);
        
        localStorage.setItem('userData', JSON.stringify(userData));
        const userRank = leaderboardData.findIndex(u => u.uid === userData.uid) + 1;
        updateUserProfile(userData, userRank);
        allProblems = problemsData;
        renderProblems(allProblems, userData.solved_problems || []);
        updateProgressBars(allProblems, userData.solved_problems || []);
        renderLeaderboard(leaderboardData, userData.uid);
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
    const searchInput = document.getElementById('searchProblems');
    if (searchInput) {
        searchInput.addEventListener('input', filterProblems);
    }
    const filterButtons = document.querySelectorAll('.difficulty-filter');
    filterButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            filterButtons.forEach(b => b.classList.remove('active', 'bg-primary'));
            btn.classList.add('active', 'bg-primary');
            currentFilter = btn.dataset.difficulty;
            filterProblems();
        });
    });
});