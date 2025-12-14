// toast and queue system
let activeToast = null;

function showToast(message, type = 'info') {
    if (activeToast) {
        activeToast.remove();
        activeToast = null;
    }
    
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type} show`;
    
    const icons = {
        success: 'fa-check-circle',
        error: 'fa-exclamation-circle',
        info: 'fa-info-circle'
    };
    
    const iconColors = {
        success: 'text-green-500',
        error: 'text-red-500',
        info: 'text-blue-500'
    };
    
    toast.innerHTML = `
        <div class="flex items-center gap-3">
            <i class="fas ${icons[type]} ${iconColors[type]} text-lg"></i>
            <p class="text-sm text-white">${message}</p>
        </div>
    `;
    
    container.appendChild(toast);
    activeToast = toast;
    
    setTimeout(() => {
        if (activeToast === toast) {
            toast.classList.add('hide');
            setTimeout(() => {
                if (toast.parentElement) {
                    toast.remove();
                }
                if (activeToast === toast) {
                    activeToast = null;
                }
            }, 300);
        }
    }, 3000);
}


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

function clearSessionAndRedirect(message = 'Session expired. Please login again.') {
    localStorage.removeItem('firebaseToken');
    localStorage.removeItem('userData');
    showToast(message, 'error');
    setTimeout(() => {
        window.location.href = '/auth';
    }, 1000);
}

//ui states
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

function updateNavbarProfile(userData) {
    const profilePic = document.getElementById('navProfilePic');
    const profileIcon = document.getElementById('navProfileIcon');
    
    if (userData.picture) {
        profilePic.src = userData.picture;
        profilePic.style.display = 'block';
        profileIcon.style.display = 'none';
    } else {
        profilePic.src = '/static/assets/hcavatar.png'; 
        profilePic.style.display = 'block'; 
        profileIcon.style.display = 'none'; 
    }
}

function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });
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

// APIs
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
            throw new Error('Failed to fetch leaderboard');
        }
        
        return await response.json();
    } catch (error) {
        console.error('Error fetching leaderboard:', error);
        throw error;
    }
}

async function updateDisplayName(uid, token, newName) {
    try {
        const response = await fetch(`/api/user/${uid}/update-name`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name: newName })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to update name');
        }
        
        return await response.json();
    } catch (error) {
        console.error('Error updating name:', error);
        throw error;
    }
}




async function uploadProfilePicture(uid, token, file) {
    try {
        const formData = new FormData();
        formData.append('picture', file);
        
        const response = await fetch(`/api/user/${uid}/upload-picture`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to upload picture');
        }
        
        return await response.json();
    } catch (error) {
        console.error('Error uploading picture:', error);
        throw error;
    }
}

async function exportUserData(uid, token) {
    try {
        const response = await fetch(`/api/user/${uid}/export-data`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to export data');
        }
        
        return await response.json();
    } catch (error) {
        console.error('Error exporting data:', error);
        throw error;
    }
}

async function deleteUserAccount(uid, token, confirmationPhrase) {
    try {
        const response = await fetch(`/api/user/${uid}/delete`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ confirmation_phrase: confirmationPhrase })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to delete account');
        }
        
        return await response.json();
    } catch (error) {
        console.error('Error deleting account:', error);
        throw error;
    }
}

let selectedFile = null;
let originalName = '';
let currentUserData = null;

function copyToClipboard(text, buttonElement) {
    navigator.clipboard.writeText(text).then(() => {
        const originalHTML = buttonElement.innerHTML;
        buttonElement.innerHTML = '<i class="fas fa-check text-green-500"></i>';
        setTimeout(() => {
            buttonElement.innerHTML = originalHTML;
        }, 2000);
        showToast('Copied to clipboard!', 'success');
    }).catch(err => {
        showToast('Failed to copy', 'error');
    });
}

function populateSettings(userData, userRank) {
    currentUserData = userData;

    const avatarPreview = document.getElementById('avatarPreview');
    const avatarUrl = userData.picture || '/static/assets/hcavatar.png';    
    if (userData.picture && userData.picture.includes('/static/uploads/')) {
        avatarPreview.src = `${avatarUrl}?t=${Date.now()}`;
    } else {
        avatarPreview.src = avatarUrl;
    }
    
    document.getElementById('displayName').value = userData.name || '';
    document.getElementById('email').value = userData.email || '';
    originalName = userData.name || '';
    document.getElementById('totalPoints').textContent = userData.points || 0;
    document.getElementById('problemsSolved').textContent = userData.problems_solved || 0;
    document.getElementById('globalRank').textContent = userRank ? `#${userRank}` : '-';
    document.getElementById('memberSince').textContent = formatDate(userData.created_at);
    const userIdElement = document.getElementById('userId');
    const fullUid = userData.uid || '-';
    userIdElement.innerHTML = `
        <span class="mr-2">${fullUid}</span>
        <button onclick="copyToClipboard('${fullUid}', this)" class="text-gray-400 hover:text-white transition">
            <i class="fas fa-copy"></i>
        </button>
    `;
    
    document.getElementById('lastActive').textContent = timeAgo(userData.last_active);
    updateNavbarProfile(userData);
    document.getElementById('profileLink').href = `/profile/${userData.uid}`;
}

function validateDisplayName(name) {
    if (!name || name.trim().length === 0) {
        return { valid: false, error: 'Display name cannot be empty' };
    }
    if (name.length > 50) {
        return { valid: false, error: 'Display name must be 50 characters or less' };
    }
    return { valid: true };
}





function validateFile(file) {
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg'];
    const maxSize = 5 * 1024 * 1024; 
    
    if (!validTypes.includes(file.type)) {
        return { valid: false, error: 'Only PNG and JPG images are allowed' };
    }
    if (file.size > maxSize) {
        return { valid: false, error: 'File size must be less than 5MB' };
    }
    return { valid: true };
}

function handleNameChange() {
    const nameInput = document.getElementById('displayName');
    const saveBtn = document.getElementById('saveNameBtn');
    const currentName = nameInput.value.trim();
    
    saveBtn.disabled = currentName === originalName || currentName.length === 0;
}

function handleFileSelect(file) {
    if (!file) return;
    
    const validation = validateFile(file);
    if (!validation.valid) {
        showToast(validation.error, 'error');
        return;
    }
    
    selectedFile = file;
    const reader = new FileReader();
    reader.onload = (e) => {
        document.getElementById('avatarPreview').src = e.target.result;
    };
    reader.readAsDataURL(file);
    
    const uploadBtn = document.getElementById('uploadBtn');
    uploadBtn.disabled = false;
    uploadBtn.innerHTML = '<i class="fas fa-save mr-2"></i>Save Profile Picture';
    uploadBtn.classList.add('bg-primary', 'hover:bg-primary-hover');
    showToast('Click "Save Profile Picture" to confirm', 'info');
}

async function handleSaveName() {
    const authData = checkAuth();
    if (!authData) return;
    
    const nameInput = document.getElementById('displayName');
    const saveBtn = document.getElementById('saveNameBtn');
    const newName = nameInput.value.trim();
    
    const validation = validateDisplayName(newName);
    if (!validation.valid) {
        showToast(validation.error, 'error');
        return;
    }
    
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Saving...';
    
    try {
        const result = await updateDisplayName(authData.user.uid, authData.token, newName);
        
        const updatedUserData = { ...currentUserData, name: newName };
        localStorage.setItem('userData', JSON.stringify(updatedUserData));
        currentUserData = updatedUserData;
        originalName = newName;
        
        updateNavbarProfile(updatedUserData);
        showToast('Display name updated successfully!', 'success');
        saveBtn.innerHTML = '<i class="fas fa-save mr-2"></i>Save Changes';
        saveBtn.disabled = true;
        
    } catch (error) {
        console.error('Error saving name:', error);
        showToast(error.message || 'Failed to update name', 'error');
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<i class="fas fa-save mr-2"></i>Save Changes';
    }
}

async function handleUploadPicture() {
    if (!selectedFile) {
        showToast('Please select an image first', 'error');
        return;
    }
    
    const authData = checkAuth();
    if (!authData) return;
    
    const uploadBtn = document.getElementById('uploadBtn');
    const avatarLoader = document.getElementById('avatarLoader');
    
    uploadBtn.disabled = true;
    uploadBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Uploading...';
    avatarLoader.classList.remove('hidden');
    
    try {
        const result = await uploadProfilePicture(authData.user.uid, authData.token, selectedFile);
        await new Promise(resolve => setTimeout(resolve, 500));
        const updatedUserData = { ...currentUserData, picture: result.picture_url };
        localStorage.setItem('userData', JSON.stringify(updatedUserData));
        currentUserData = updatedUserData;
        const avatarPreview = document.getElementById('avatarPreview');
        avatarPreview.src = `${result.picture_url}?t=${Date.now()}`;
        
        updateNavbarProfile(updatedUserData);
        showToast('Profile picture updated successfully!', 'success');
        selectedFile = null;
        uploadBtn.innerHTML = '<i class="fas fa-upload mr-2"></i>Upload Picture';
        uploadBtn.classList.remove('bg-primary', 'hover:bg-primary-hover');
        uploadBtn.disabled = true;
        avatarLoader.classList.add('hidden');
        
    } catch (error) {
        console.error('Error uploading picture:', error);
        showToast(error.message || 'Failed to upload picture', 'error');
        uploadBtn.disabled = false;
        uploadBtn.innerHTML = '<i class="fas fa-save mr-2"></i>Save Profile Picture';
        avatarLoader.classList.add('hidden');
    }
}

// Export Data 
async function handleExportData() {
    const authData = checkAuth();
    if (!authData) return;
    
    const exportBtn = document.getElementById('exportDataBtn');
    const originalHTML = exportBtn.innerHTML;
    
    exportBtn.disabled = true;
    exportBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Exporting...';
    
    try {
        const data = await exportUserData(authData.user.uid, authData.token);
        
        const jsonString = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `leetcohort-data-${authData.user.uid}-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        showToast('Data exported successfully!', 'success');
        exportBtn.innerHTML = originalHTML;
        exportBtn.disabled = false;
        
    } catch (error) {
        console.error('Error exporting data:', error);
        showToast(error.message || 'Failed to export data', 'error');
        exportBtn.innerHTML = originalHTML;
        exportBtn.disabled = false;
    }
}

// Delete Account Modal 
let deleteStep = 1;

function showDeleteModal() {
    document.getElementById('deleteModal').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    resetDeleteModal();
}

function hideDeleteModal() {
    document.getElementById('deleteModal').classList.add('hidden');
    document.body.style.overflow = 'auto';
    resetDeleteModal();
}

function resetDeleteModal() {
    deleteStep = 1;
    document.getElementById('deleteStep1').classList.remove('hidden', 'completed');
    document.getElementById('deleteStep2').classList.add('hidden');
    document.getElementById('deleteStep2').classList.remove('completed');
    document.getElementById('deleteStep3').classList.add('hidden');
    document.getElementById('deleteProgress').style.width = '0%';
    document.getElementById('deleteConfirmationInput').value = '';
    
    document.querySelectorAll('.delete-checkbox').forEach(cb => cb.checked = false);
    document.getElementById('continueStep2').disabled = true;
    document.getElementById('finalDeleteBtn').disabled = true;
}

function updateDeleteProgress() {
    const progress = (deleteStep / 3) * 100;
    document.getElementById('deleteProgress').style.width = `${progress}%`;
}

function handleDeleteStep1() {
    deleteStep = 2;
    document.getElementById('deleteStep1').classList.add('completed');
    document.getElementById('deleteStep2').classList.remove('hidden');
    updateDeleteProgress();
}

function handleDeleteCheckboxes() {
    const checkboxes = document.querySelectorAll('.delete-checkbox');
    const allChecked = Array.from(checkboxes).every(cb => cb.checked);
    document.getElementById('continueStep2').disabled = !allChecked;
}

function handleDeleteStep2() {
    deleteStep = 3;
    document.getElementById('deleteStep2').classList.add('completed');
    document.getElementById('deleteStep3').classList.remove('hidden');
    updateDeleteProgress();
}

function handleDeleteInputChange() {
    const input = document.getElementById('deleteConfirmationInput');
    const deleteBtn = document.getElementById('finalDeleteBtn');
    deleteBtn.disabled = input.value !== 'DELETE MY ACCOUNT';
}

async function handleFinalDelete() {
    const authData = checkAuth();
    if (!authData) return;
    
    const input = document.getElementById('deleteConfirmationInput');
    const deleteBtn = document.getElementById('finalDeleteBtn');
    
    if (input.value !== 'DELETE MY ACCOUNT') {
        showToast('Please type the confirmation phrase exactly', 'error');
        return;
    }
    
    deleteBtn.disabled = true;
    deleteBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Deleting Account...';
    
    try {
        await deleteUserAccount(authData.user.uid, authData.token, input.value);
        
        showToast('Account deleted successfully', 'success');
        
        localStorage.removeItem('firebaseToken');
        localStorage.removeItem('userData');
        
        setTimeout(() => {
            window.location.href = '/';
        }, 2000);
        
    } catch (error) {
        console.error('Error deleting account:', error);
        showToast(error.message || 'Failed to delete account', 'error');
        deleteBtn.disabled = false;
        deleteBtn.innerHTML = '<i class="fas fa-trash mr-2"></i>Permanently Delete Account';
    }
}

// dragndrop
function setupDragAndDrop() {
    const uploadArea = document.querySelector('.upload-area');
    
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('dragging');
    });
    
    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('dragging');
    });
    
    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('dragging');
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFileSelect(files[0]);
        }
    });
}

window.copyToClipboard = copyToClipboard;

// init
async function initSettingsPage() {
    const authData = checkAuth();
    if (!authData) return;
    
    showLoading();
    
    try {
        const [userData, leaderboardData] = await Promise.all([
            fetchUserData(authData.user.uid, authData.token),
            fetchLeaderboard(authData.token)
        ]);
        
        const userRank = leaderboardData.findIndex(u => u.uid === userData.uid) + 1;
        populateSettings(userData, userRank);
        showContent();
        
    } catch (error) {
        console.error('Error initializing settings:', error);
        
        if (error.message === 'INVALID_TOKEN') {
            clearSessionAndRedirect('Session expired. Please login again.');
            return;
        }
        
        showError(error.message || 'Failed to load settings. Please try again.');
        showToast(error.message || 'Failed to load settings', 'error');
    }
}




document.addEventListener('DOMContentLoaded', () => {
    initSettingsPage();
    setupDragAndDrop();


    document.getElementById('logoutBtn').addEventListener('click', handleLogout);
    document.getElementById('displayName').addEventListener('input', handleNameChange);
    document.getElementById('avatarUpload').addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFileSelect(e.target.files[0]);
        }
    });
    document.getElementById('saveNameBtn').addEventListener('click', handleSaveName);
    document.getElementById('uploadBtn').addEventListener('click', handleUploadPicture);
        document.getElementById('exportDataBtn').addEventListener('click', handleExportData);
    
    document.getElementById('deleteAccountBtn').addEventListener('click', showDeleteModal);
    document.getElementById('cancelDelete').addEventListener('click', hideDeleteModal);
    document.getElementById('continueStep1').addEventListener('click', handleDeleteStep1);
    document.getElementById('continueStep2').addEventListener('click', handleDeleteStep2);
    document.getElementById('finalDeleteBtn').addEventListener('click', handleFinalDelete);
    
    document.querySelectorAll('.delete-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', handleDeleteCheckboxes);
    });
    document.getElementById('deleteConfirmationInput').addEventListener('input', handleDeleteInputChange);

    document.querySelector('.modal-backdrop')?.addEventListener('click', hideDeleteModal);
});