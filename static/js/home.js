// toast notification

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
        window.location.href = '/auth';
        return null;
    }
    
    return {
        token: token,
        user: JSON.parse(userData)
    };
}

// clear invalid sessions 
function clearSessionAndRedirect(message = 'Session expired. Please login again.') {
    localStorage.removeItem('firebaseToken');
    localStorage.removeItem('userData');
    showToast(message, 'error');
    setTimeout(() => {
        window.location.href = '/auth';
    }, 1000);
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

function updateNavbarProfile(userData) {
    const profilePic = document.getElementById('navProfilePic');
    const profileIcon = document.getElementById('navProfileIcon');
    
    if (userData.picture) {
        profilePic.src = userData.picture;
        profilePic.style.display = 'block';
        profileIcon.style.display = 'none';
    } else {
        profilePic.style.display = 'none';
        profileIcon.style.display = 'block';
    }
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
    
    updateNavbarProfile(userData);
    document.getElementById('profileLink').href = `/profile/${userData.uid}`;
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
    
    setTimeout(() => {
        ['Easy', 'Medium', 'Hard'].forEach(diff => {
            const total = difficulties[diff] || 0;
            const count = solved[diff] || 0;
            const percent = total > 0 ? (count / total * 100) : 0;
            
            const progressEl = document.getElementById(`${diff.toLowerCase()}Progress`);
            const barEl = document.getElementById(`${diff.toLowerCase()}Bar`);
            
            if (progressEl) progressEl.textContent = `${count}/${total}`;
            if (barEl) barEl.style.width = `${percent}%`;
        });
    }, 100);
}


function renderProblems(problems, solvedProblems) {
    const container = document.getElementById('problemsList');
    
    if (!container) {
        console.error('Problems container not found!');
        return;
    }
    
    const solvedIds = Array.isArray(solvedProblems) 
        ? solvedProblems 
        : (solvedProblems?.solved_problems || []);
    
    if (problems.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 60px 20px; color: #6b7280;">
                <i class="fas fa-inbox" style="font-size: 64px; opacity: 0.2; margin-bottom: 20px;"></i>
                <p style="font-size: 18px; font-weight: 600;">No problems available</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = problems.map(problem => {
        const isSolved = solvedIds.includes(problem.id);
        const difficultyClass = `difficulty-${problem.difficulty.toLowerCase()}`;
        const topics = problem.topic_tags || [];
        const companies = problem.company_tags || [];
        
        const allTags = [...topics.slice(0, 1), ...companies.slice(0, 1)];
        const tagsHTML = allTags.map(tag => 
            `<span class="topic-tag">${tag}</span>`
        ).join('');
        
        const remainingCount = (topics.length + companies.length) - allTags.length;
        
        return `
            <div class="problem-item p-3 cursor-pointer" onclick="window.location.href='/problem/${problem.slug}'">
                <div class="flex items-center justify-between gap-3">
                    <div class="flex items-center gap-3 flex-1 min-w-0">
                        <span class="text-gray-400 text-sm font-semibold" style="min-width: 35px;">#${problem.id}</span>
                        ${isSolved ? '<i class="fas fa-check-circle text-green-500 text-xs flex-shrink-0"></i>' : '<span class="w-3"></span>'}
                        <h3 class="text-sm font-medium text-white truncate flex-1">${problem.title}</h3>
                    </div>
                    <div class="flex items-center gap-2 flex-shrink-0">
                        ${tagsHTML}
                        ${remainingCount > 0 ? `<span class="topic-tag">+${remainingCount}</span>` : ''}
                        <span class="difficulty-badge ${difficultyClass}">${problem.difficulty}</span>
                        <span class="points-badge">
                            <i class="fas fa-star"></i>
                            ${problem.points}
                        </span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function navigateToProblem(slug) {
    window.location.href = `/problem/${slug}`;
}

// leaderboard
function renderLeaderboard(leaderboard, currentUserId) {
    const leaderboardList = document.getElementById('leaderboardList');
    const userRankInfo = document.getElementById('userRankInfo');
    const currentUserRank = document.getElementById('currentUserRank');
    
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
    
    const currentUserIndex = leaderboard.findIndex(u => u.uid === currentUserId);
    const isInTop10 = currentUserIndex < 10 && currentUserIndex !== -1;
    const top10 = leaderboard.slice(0, 10);
    
    leaderboardList.innerHTML = top10.map((user, index) => {
        const isCurrentUser = user.uid === currentUserId;
        const rankColors = {
            0: 'text-yellow-400',
            1: 'text-gray-300',
            2: 'text-orange-400'
        };
        
        return `
            <a href="/profile/${user.uid}" class="block">
                <div class="leaderboard-item flex items-center gap-3 p-3 rounded-lg transition cursor-pointer ${isCurrentUser ? 'bg-white bg-opacity-5 border border-white border-opacity-10' : 'hover:bg-white hover:bg-opacity-5'}" data-rank="${index + 1}">
                    <div class="flex items-center justify-center w-6 text-sm font-semibold ${rankColors[index] || 'text-gray-500'}">
                        ${index < 3 ? `<i class="fas fa-medal medal-icon"></i>` : `${index + 1}`}
                    </div>
                    <img src="${user.picture || 'https://via.placeholder.com/32'}"  
                        class="h-8 w-8 rounded-full border-2 border-white border-opacity-10 transition-transform hover:scale-110"
                        loading="lazy"
                        alt="${user.name}">
                    <div class="flex-1 min-w-0">
                        <p class="text-sm font-medium truncate text-white">${user.name}</p>
                        <p class="text-xs text-gray-500">${user.problems_solved} solved</p>
                    </div>
                    <div class="text-sm font-semibold text-white">${user.points}</div>
                </div>
            </a>
        `;
    }).join('');
    
    if (!isInTop10 && currentUserIndex !== -1) {
        userRankInfo.classList.remove('hidden');
        currentUserRank.textContent = `#${currentUserIndex + 1}`;
    } else {
        userRankInfo.classList.add('hidden');
    }
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
                throw new Error('INVALID_TOKEN');
            }
            throw new Error('Failed to fetch user data');
        }
        
        return await response.json();
    } catch (error) {
        console.error('Error fetching user data:', error);
        throw error;
    }
}

async function fetchProblems(token) {
    try {
        const response = await fetch('/api/problems', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            if (response.status === 401) {
                throw new Error('INVALID_TOKEN');
            }
            throw new Error('Failed to fetch problems');
        }
        
        return await response.json();
    } catch (error) {
        console.error('Error fetching problems:', error);
        throw error;
    }
}

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
                throw new Error('INVALID_TOKEN');
            }
            throw new Error('Failed to fetch leaderboard');
        }
        
        return await response.json();
    } catch (error) {
        console.error('Error fetching leaderboard:', error);
        throw error;
    }
}

let allProblems = [];
let currentFilter = 'all';
let selectedTopics = new Set();
let selectedCompanies = new Set();
let isFiltering = false;

function getAllTopics(problems) {
    const topicsSet = new Set();
    problems.forEach(problem => {
        const topics = problem.topic_tags || [];
        topics.forEach(topic => topicsSet.add(topic));
    });
    return Array.from(topicsSet).sort();
}

function getAllCompanies(problems) {
    const companiesSet = new Set();
    problems.forEach(problem => {
        const companies = problem.company_tags || [];
        companies.forEach(company => companiesSet.add(company));
    });
    return Array.from(companiesSet).sort();
}

function renderTopicFilter() {
    const topics = getAllTopics(allProblems);
    const dropdown = document.getElementById('topicDropdown');
    const filterBtnText = document.getElementById('topicFilterText');
    
    if (selectedTopics.size > 0) {
        filterBtnText.textContent = `Topics (${selectedTopics.size})`;
        document.getElementById('topicFilterBtn').classList.add('has-filter');
    } else {
        filterBtnText.textContent = 'Topic';
        document.getElementById('topicFilterBtn').classList.remove('has-filter');
    }

    dropdown.innerHTML = `
        <div class="topic-filter-header">
            <span>Filter by Topic</span>
            ${selectedTopics.size > 0 ? 
                `<span class="clear-filters-btn" id="clearTopicsBtn">Clear All</span>` 
                : ''}
        </div>
        ${topics.map(topic => {
            const isActive = selectedTopics.has(topic);
            return `
            <button class="topic-filter-item ${isActive ? 'active' : ''}" data-topic="${topic}">
                <span>${topic}</span>
                <div class="topic-check">
                    <i class="fas fa-check"></i>
                </div>
            </button>
            `;
        }).join('')}
    `;
    
    dropdown.querySelectorAll('.topic-filter-item').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            
            const topic = btn.dataset.topic;
            if (selectedTopics.has(topic)) {
                selectedTopics.delete(topic);
            } else {
                selectedTopics.add(topic);
            }
            renderTopicFilter();
            filterProblems();
        });
    });

    const clearBtn = document.getElementById('clearTopicsBtn');
    if (clearBtn) {
        clearBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            selectedTopics.clear();
            renderTopicFilter();
            filterProblems();
        });
    }
}

function renderCompanyFilter() {
    const companies = getAllCompanies(allProblems);
    const dropdown = document.getElementById('companyDropdown');
    const filterBtnText = document.getElementById('companyFilterText');
    
    if (selectedCompanies.size > 0) {
        filterBtnText.textContent = `Companies (${selectedCompanies.size})`;
        document.getElementById('companyFilterBtn').classList.add('has-filter');
    } else {
        filterBtnText.textContent = 'Company';
        document.getElementById('companyFilterBtn').classList.remove('has-filter');
    }

    dropdown.innerHTML = `
        <div class="topic-filter-header">
            <span>Filter by Company</span>
            ${selectedCompanies.size > 0 ? 
                `<span class="clear-filters-btn" id="clearCompaniesBtn">Clear All</span>` 
                : ''}
        </div>
        ${companies.map(company => {
            const isActive = selectedCompanies.has(company);
            return `
            <button class="topic-filter-item ${isActive ? 'active' : ''}" data-company="${company}">
                <span>${company}</span>
                <div class="topic-check">
                    <i class="fas fa-check"></i>
                </div>
            </button>
            `;
        }).join('')}
    `;
    
    dropdown.querySelectorAll('.topic-filter-item').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            
            const company = btn.dataset.company;
            if (selectedCompanies.has(company)) {
                selectedCompanies.delete(company);
            } else {
                selectedCompanies.add(company);
            }
            renderCompanyFilter();
            filterProblems();
        });
    });

    const clearBtn = document.getElementById('clearCompaniesBtn');
    if (clearBtn) {
        clearBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            selectedCompanies.clear();
            renderCompanyFilter();
            filterProblems();
        });
    }
}

function toggleTopicDropdown() {
    const dropdown = document.getElementById('topicDropdown');
    const companyDropdown = document.getElementById('companyDropdown');
    dropdown.classList.toggle('hidden');
    companyDropdown.classList.add('hidden');
}

function toggleCompanyDropdown() {
    const dropdown = document.getElementById('companyDropdown');
    const topicDropdown = document.getElementById('topicDropdown');
    dropdown.classList.toggle('hidden');
    topicDropdown.classList.add('hidden');
}

document.addEventListener('click', (e) => {
    const topicDropdown = document.getElementById('topicDropdown');
    const topicBtn = document.getElementById('topicFilterBtn');
    const companyDropdown = document.getElementById('companyDropdown');
    const companyBtn = document.getElementById('companyFilterBtn');
    
    if (topicDropdown && topicBtn && !topicDropdown.contains(e.target) && !topicBtn.contains(e.target)) {
        topicDropdown.classList.add('hidden');
    }
    
    if (companyDropdown && companyBtn && !companyDropdown.contains(e.target) && !companyBtn.contains(e.target)) {
        companyDropdown.classList.add('hidden');
    }
});

function filterProblems() {
    if (isFiltering) return;
    isFiltering = true;
    const searchTerm = document.getElementById('searchProblems').value.toLowerCase();
    const authData = checkAuth();
    const solvedProblems = authData.user.solved_problems || [];
    
    let filtered = allProblems;
    
    if (currentFilter !== 'all') {
        filtered = filtered.filter(p => p.difficulty === currentFilter);
    }
    
    if (selectedTopics.size > 0) {
        filtered = filtered.filter(p => {
            const problemTopics = p.topic_tags || [];
            return Array.from(selectedTopics).every(selected => problemTopics.includes(selected));
        });
    }
    
    if (selectedCompanies.size > 0) {
        filtered = filtered.filter(p => {
            const problemCompanies = p.company_tags || [];
            return Array.from(selectedCompanies).every(selected => problemCompanies.includes(selected));
        });
    }
    
    if (searchTerm) {
        filtered = filtered.filter(p => 
            p.title.toLowerCase().includes(searchTerm) || 
            (p.description && p.description.toLowerCase().includes(searchTerm))
        );
    }
    
    setTimeout(() => {
        renderProblems(filtered, solvedProblems);
        isFiltering = false;
    }, 50);
}

//logout

function handleLogout() {
    localStorage.removeItem('firebaseToken');
    localStorage.removeItem('userData');
    showToast('Logged out successfully', 'success');
    setTimeout(() => {
        window.location.href = '/';
    }, 500);
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
        renderTopicFilter();
        renderCompanyFilter();
        showContent();

    } catch (error) {
        console.error('Error initializing home page:', error);
        
        if (error.message === 'INVALID_TOKEN') {
            clearSessionAndRedirect('Session expired. Please login again.');
            return;
        }
        
        showError(error.message || 'Failed to load your dashboard. Please try logging in again.');
        showToast(error.message || 'Failed to load dashboard', 'error');
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
        let debounceTimer;
        searchInput.addEventListener('input', () => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(filterProblems, 300);
        });
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
    
    const topicFilterBtn = document.getElementById('topicFilterBtn');
    if (topicFilterBtn) {
        topicFilterBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleTopicDropdown();
        });
    }
    
    const companyFilterBtn = document.getElementById('companyFilterBtn');
    if (companyFilterBtn) {
        companyFilterBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleCompanyDropdown();
        });
    }
});

window.navigateToProblem = navigateToProblem;