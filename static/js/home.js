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
            <div class="p-12 text-center text-gray-500">
                <i class="fas fa-inbox text-3xl mb-3 opacity-30"></i>
                <p class="text-sm">No problems found</p>
            </div>
        `;
        return;
    }
    
    problemsList.innerHTML = problems.map((problem, index) => {
        const isSolved = solvedProblems.includes(problem.id);
        const difficultyColors = {
            'Easy': 'text-green-500',
            'Medium': 'text-yellow-500',
            'Hard': 'text-red-500'
        };
        return `
            <div class="p-5 cursor-pointer problem-item" data-difficulty="${problem.difficulty}">
                <div class="flex items-start gap-4">
                    <div class="flex items-center justify-center w-8 text-gray-500 font-medium text-sm flex-shrink-0 mt-0.5">
                        ${index + 1}
                    </div>
                    <div class="flex items-center justify-center w-5 flex-shrink-0 mt-0.5">
                        ${isSolved ? '<i class="fas fa-check-circle text-white text-sm"></i>' : '<i class="far fa-circle text-gray-600 text-sm"></i>'}
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="flex items-start justify-between gap-4 mb-2">
                            <h3 class="font-medium text-white text-base">${problem.title}</h3>
                            <span class="text-sm font-medium ${difficultyColors[problem.difficulty]} flex-shrink-0">${problem.difficulty}</span>
                        </div>
                        <p class="text-sm text-gray-400 leading-relaxed">${problem.description}</p>
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
            <div class="text-center text-gray-500 py-8">
                <i class="fas fa-users text-2xl mb-2 opacity-30"></i>
                <p class="text-xs">No users yet</p>
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
            <div class="flex items-center gap-3 p-3 rounded-lg transition ${isCurrentUser ? 'bg-white bg-opacity-5 border border-white border-opacity-10' : 'hover:bg-white hover:bg-opacity-5'}">
                <div class="flex items-center justify-center w-6 text-sm font-semibold ${rankColors[index] || 'text-gray-500'}">
                    ${index < 3 ? '<i class="fas fa-medal"></i>' : `${index + 1}`}
                </div>
                <img src="${user.picture || 'https://via.placeholder.com/32'}" alt="${user.name}" class="h-8 w-8 rounded-full border border-white border-opacity-10">
                <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium truncate text-white">${user.name}</p>
                    <p class="text-xs text-gray-500">${user.problems_solved} solved</p>
                </div>
                <div class="text-sm font-semibold text-white">${user.points}</div>
            </div>
        `;
    }).join('');
}

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
        console.error('Error initializing home page:', error);
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
            filterButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.difficulty;
            filterProblems();
        });
    });
});