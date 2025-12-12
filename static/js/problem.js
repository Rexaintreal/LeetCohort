// toast noti
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast`;
    
    const icons = {
        success: 'fa-check-circle text-green-500',
        error: 'fa-exclamation-circle text-red-500',
        info: 'fa-info-circle text-blue-500'
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

// init CODEMIRROR 
let editor;
let currentProblem = null;

function initCodeEditor(boilerplateCode = '') {
    editor = CodeMirror.fromTextArea(document.getElementById('codeEditor'), {
        mode: 'python',
        theme: 'dracula',
        lineNumbers: true,
        indentUnit: 4,
        indentWithTabs: false,
        lineWrapping: true,
        autoCloseBrackets: true,
        matchBrackets: true,
        extraKeys: {
            'Ctrl-Space': 'autocomplete',
            'Tab': function(cm) {
                if (cm.somethingSelected()) {
                    cm.indentSelection('add');
                } else {
                    cm.replaceSelection('    ', 'end');
                }
            }
        }
    });
    
    editor.setValue(boilerplateCode);
    editor.setSize('100%', '100%');
}

// langs
const languageModes = {
    '71': 'python',
    '63': 'javascript',
    '62': 'text/x-java',
    '50': 'text/x-csrc',
    '54': 'text/x-c++src',
    '51': 'text/x-csharp',
    '68': 'application/x-httpd-php',
    '72': 'text/x-ruby',
    '73': 'text/x-rustsrc',
    '60': 'text/x-go'
};

// getting problem details
async function fetchProblemDetail(slug) {
    const authData = checkAuth();
    if (!authData) return null;
    
    try {
        const response = await fetch(`/api/problem/${slug}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${authData.token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to fetch problem');
        }
        
        return await response.json();
    } catch (error) {
        console.error('Error fetching problem:', error);
        throw error;
    }
}

// problem details
function renderProblem(problem) {
    currentProblem = problem;
    
    document.getElementById('problemTitle').textContent = problem.title;
    
    const difficultyBadge = document.getElementById('problemDifficulty');
    difficultyBadge.textContent = problem.difficulty;
    difficultyBadge.className = `px-3 py-1 rounded-full text-sm font-semibold difficulty-${problem.difficulty.toLowerCase()}`;
    
    document.getElementById('problemDescription').innerHTML = formatDescription(problem.description);
    const hintsContainer = document.getElementById('hintsContainer');
    if (problem.hint && problem.hint.length > 0) {
        hintsContainer.innerHTML = problem.hint.map((h, idx) => `
            <div class="hint-item p-4 rounded-lg">
                <div class="flex items-start gap-3">
                    <i class="fas fa-lightbulb text-primary mt-1"></i>
                    <div>
                        <p class="text-sm font-semibold text-white mb-1">Hint ${idx + 1}</p>
                        <p class="text-sm text-gray-300">${h.hint}</p>
                    </div>
                </div>
            </div>
        `).join('');
    } else {
        hintsContainer.innerHTML = '<p class="text-gray-500 text-sm">No hints available for this problem</p>';
    }
    initCodeEditor(problem.boilerplate_code || '# Write your solution here\n');
}

function formatDescription(description) {
    const paragraphs = description.split('\n\n').filter(p => p.trim());
    return paragraphs.map(p => `<p class="mb-3">${p.trim()}</p>`).join('');
}

//switching tab
function initTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tabName = btn.dataset.tab;
            
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            
            btn.classList.add('active');
            document.getElementById(`${tabName}Tab`).classList.add('active');
        });
    });
    
    document.querySelectorAll('.console-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tabName = btn.dataset.tab;
            
            document.querySelectorAll('.console-tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.console-content').forEach(c => c.classList.add('hidden'));
            
            btn.classList.add('active');
            document.getElementById(`${tabName}Console`).classList.remove('hidden');
        });
    });
}

// changeLang
document.getElementById('languageSelect')?.addEventListener('change', (e) => {
    const languageId = e.target.value;
    const mode = languageModes[languageId] || 'python';
    editor.setOption('mode', mode);
});

// runCode 
async function runCode() {
    const authData = checkAuth();
    if (!authData) return;
    
    const code = editor.getValue();
    const languageId = parseInt(document.getElementById('languageSelect').value);
    
    if (!code.trim()) {
        showToast('Please write some code first', 'error');
        return;
    }
    
    const runBtn = document.getElementById('runBtn');
    runBtn.disabled = true;
    runBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> <span>Running...</span>';
    
    try {
        const response = await fetch(`/api/problem/${PROBLEM_SLUG}/run`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authData.token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                code: code,
                language_id: languageId,
                input: '' 
            })
        });
        
        const result = await response.json();
        
        if (!response.ok) {
            throw new Error(result.error || 'Failed to run code');
        }
        
        displayRunResult(result);
        showToast('Code executed successfully', 'success');
        
    } catch (error) {
        console.error('Error running code:', error);
        showToast(error.message || 'Failed to run code', 'error');
        displayRunError(error.message);
    } finally {
        runBtn.disabled = false;
        runBtn.innerHTML = '<i class="fas fa-play"></i> <span>Run</span>';
    }
}

function displayRunResult(result) {
    const testcasesConsole = document.getElementById('testcasesConsole');
    
    if (result.error) {
        testcasesConsole.innerHTML = `
            <div class="bg-red-500 bg-opacity-10 border border-red-500 border-opacity-20 rounded-lg p-4">
                <p class="text-red-400 font-semibold mb-2">Error:</p>
                <pre class="text-red-300 text-xs whitespace-pre-wrap">${result.error}</pre>
            </div>
        `;
    } else {
        testcasesConsole.innerHTML = `
            <div class="bg-white bg-opacity-5 border border-white border-opacity-10 rounded-lg p-4">
                <p class="text-gray-400 font-semibold mb-2">Output:</p>
                <pre class="text-green-400 text-xs whitespace-pre-wrap">${result.output || '(empty output)'}</pre>
                <p class="text-gray-500 text-xs mt-2">Status: ${result.status}</p>
            </div>
        `;
    }
    document.querySelector('[data-tab="testcases"]').click();
}

function displayRunError(error) {
    const testcasesConsole = document.getElementById('testcasesConsole');
    testcasesConsole.innerHTML = `
        <div class="bg-red-500 bg-opacity-10 border border-red-500 border-opacity-20 rounded-lg p-4">
            <p class="text-red-400 font-semibold mb-2">Error:</p>
            <pre class="text-red-300 text-xs whitespace-pre-wrap">${error}</pre>
        </div>
    `;
}

// submit function
async function submitCode() {
    const authData = checkAuth();
    if (!authData) return;
    
    const code = editor.getValue();
    const languageId = parseInt(document.getElementById('languageSelect').value);
    
    if (!code.trim()) {
        showToast('Please write some code first', 'error');
        return;
    }
    
    const submitBtn = document.getElementById('submitBtn');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> <span>Submitting...</span>';
    
    try {
        const response = await fetch(`/api/problem/${PROBLEM_SLUG}/submit`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authData.token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                code: code,
                language_id: languageId
            })
        });
        
        const result = await response.json();
        
        if (!response.ok) {
            throw new Error(result.error || 'Failed to submit code');
        }
        
        displaySubmitResults(result);
        
        if (result.all_passed) {
            showToast('All test cases passed!', 'success');
            const userData = JSON.parse(localStorage.getItem('userData'));
            if (!userData.solved_problems.includes(currentProblem.id)) {
                userData.solved_problems.push(currentProblem.id);
                userData.problems_solved++;
                userData.points += result.total_points;
                localStorage.setItem('userData', JSON.stringify(userData));
            }
        } else {
            showToast('Some test cases failed', 'error');
        }
        
    } catch (error) {
        console.error('Error submitting code:', error);
        showToast(error.message || 'Failed to submit code', 'error');
        displaySubmitError(error.message);
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-check"></i> <span>Submit</span>';
    }
}

function displaySubmitResults(result) {
    const resultsConsole = document.getElementById('resultsConsole');
    
    const passedCount = result.results.filter(r => r.passed).length;
    const totalCount = result.results.length;
    
    let html = `
        <div class="mb-4 p-4 rounded-lg ${result.all_passed ? 'bg-green-500 bg-opacity-10 border border-green-500 border-opacity-20' : 'bg-red-500 bg-opacity-10 border border-red-500 border-opacity-20'}">
            <p class="font-semibold ${result.all_passed ? 'text-green-400' : 'text-red-400'}">
                ${result.all_passed ? '✓ Accepted' : '✗ Wrong Answer'}
            </p>
            <p class="text-sm text-gray-400 mt-1">${passedCount} / ${totalCount} test cases passed</p>
            ${result.all_passed ? `<p class="text-sm text-green-400 mt-1">+${result.total_points} points</p>` : ''}
        </div>
    `;
    
    html += '<div class="space-y-3">';
    
    result.results.forEach((test, idx) => {
        html += `
            <div class="p-4 rounded-lg border border-white border-opacity-10 ${test.passed ? 'test-case-passed' : 'test-case-failed'}">
                <div class="flex items-center justify-between mb-2">
                    <p class="font-semibold text-sm ${test.passed ? 'text-green-400' : 'text-red-400'}">
                        Test Case ${idx + 1}
                    </p>
                    <span class="text-xs ${test.passed ? 'text-green-400' : 'text-red-400'}">
                        ${test.passed ? '✓ Passed' : '✗ Failed'}
                    </span>
                </div>
                <div class="text-xs space-y-2">
                    <div>
                        <p class="text-gray-500 mb-1">Input:</p>
                        <pre class="text-gray-300 bg-black bg-opacity-30 p-2 rounded">${test.input || '(empty)'}</pre>
                    </div>
                    <div>
                        <p class="text-gray-500 mb-1">Expected Output:</p>
                        <pre class="text-gray-300 bg-black bg-opacity-30 p-2 rounded">${test.expected_output}</pre>
                    </div>
                    <div>
                        <p class="text-gray-500 mb-1">Your Output:</p>
                        <pre class="${test.passed ? 'text-green-400' : 'text-red-400'} bg-black bg-opacity-30 p-2 rounded">${test.actual_output || '(empty)'}</pre>
                    </div>
                    ${test.error ? `
                    <div>
                        <p class="text-gray-500 mb-1">Error:</p>
                        <pre class="text-red-400 bg-black bg-opacity-30 p-2 rounded">${test.error}</pre>
                    </div>
                    ` : ''}
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    
    resultsConsole.innerHTML = html;
    document.querySelector('[data-tab="results"]').click();
}

function displaySubmitError(error) {
    const resultsConsole = document.getElementById('resultsConsole');
    resultsConsole.innerHTML = `
        <div class="bg-red-500 bg-opacity-10 border border-red-500 border-opacity-20 rounded-lg p-4">
            <p class="text-red-400 font-semibold mb-2">Submission Error:</p>
            <pre class="text-red-300 text-xs whitespace-pre-wrap">${error}</pre>
        </div>
    `;
}

// logout
function handleLogout() {
    localStorage.removeItem('firebaseToken');
    localStorage.removeItem('userData');
    window.location.href = '/auth';
}

// init
async function initProblemPage() {
    const authData = checkAuth();
    if (!authData) return;
    
    try {
        const problem = await fetchProblemDetail(PROBLEM_SLUG);
        
        if (!problem) {
            document.getElementById('loadingState').classList.add('hidden');
            document.getElementById('errorState').classList.remove('hidden');
            return;
        }
        
        renderProblem(problem);
        initTabs();
        
        document.getElementById('loadingState').classList.add('hidden');
        document.getElementById('mainContent').classList.remove('hidden');
        
    } catch (error) {
        console.error('Error initializing problem page:', error);
        document.getElementById('loadingState').classList.add('hidden');
        document.getElementById('errorState').classList.remove('hidden');
    }
}


document.addEventListener('DOMContentLoaded', () => {
    initProblemPage();
    
    document.getElementById('runBtn')?.addEventListener('click', runCode);
    document.getElementById('submitBtn')?.addEventListener('click', submitCode);
    document.getElementById('logoutBtn')?.addEventListener('click', handleLogout);
});