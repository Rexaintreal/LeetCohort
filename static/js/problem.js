// toast noti
function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icon = type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle';
    toast.innerHTML = `
        <div style="display: flex; align-items: center; gap: 12px;">
            <i class="fas ${icon}" style="font-size: 18px;"></i>
            <span style="font-size: 14px; font-weight: 500;">${message}</span>
        </div>
    `;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideIn 0.3s ease-out reverse';
        setTimeout(() => toast.remove(), 300);
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
        lineWrapping: false,
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
    difficultyBadge.className = `difficulty-${problem.difficulty.toLowerCase()} px-3 py-1 rounded-full text-xs font-semibold`;
    
    document.getElementById('problemDescription').innerHTML = formatDescription(problem.description); 
    renderExamples(problem.test_cases);
    renderHints(problem.hint);
    initCodeEditor(problem.boilerplate_code || '# Write your solution here\n');
}

function formatDescription(description) {
    const paragraphs = description.split('\n\n').filter(p => p.trim());
    return paragraphs.map(p => `<p>${p.trim()}</p>`).join('');
}

function renderExamples(testCases) {
    const container = document.getElementById('examplesContainer');
    
    if (!testCases || testCases.length === 0) {
        container.innerHTML = '<p style="color: #6b7280; font-size: 14px;">No examples available</p>';
        return;
    }
    
    const examples = testCases.slice(0, 3);
    container.innerHTML = examples.map((tc, idx) => `
        <div class="example-box">
            <div class="example-label">Example ${idx + 1}:</div>
            <div class="example-content"><strong>Input:</strong> ${tc.input}
<strong>Output:</strong> ${tc.expected_output}</div>
        </div>
    `).join('');
}

function renderHints(hints) {
    const container = document.getElementById('hintsContainer');
    
    if (!hints || hints.length === 0) {
        document.getElementById('hintsSection').style.display = 'none';
        return;
    }
    
    container.innerHTML = hints.map((h, idx) => `
        <div class="hint-item">
            <p><strong>Hint ${idx + 1}:</strong> ${h.hint}</p>
        </div>
    `).join('');
}

function initResizer() {
    const resizer = document.getElementById('resizer');
    const leftPanel = document.getElementById('leftPanel');
    let isResizing = false;

    resizer.addEventListener('mousedown', (e) => {
        isResizing = true;
        resizer.classList.add('resizing');
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
    });

    document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;
        
        const containerWidth = document.querySelector('.split-container').offsetWidth;
        const newWidth = (e.clientX / containerWidth) * 100;
        
        if (newWidth >= 25 && newWidth <= 60) {
            leftPanel.style.width = `${newWidth}%`;
        }
    });

    document.addEventListener('mouseup', () => {
        if (isResizing) {
            isResizing = false;
            resizer.classList.remove('resizing');
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        }
    });
}

// console
function initConsoleTabs() {
    const consoleTabs = document.querySelectorAll('.console-tab');
    const consoleOutputs = document.querySelectorAll('.console-output');

    consoleTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.dataset.tab;
            
            consoleTabs.forEach(t => t.classList.remove('active'));
            consoleOutputs.forEach(o => o.classList.remove('active'));
            
            tab.classList.add('active');
            document.getElementById(`${tabName}Output`).classList.add('active');
        });
    });
}

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
        
        document.querySelector('[data-tab="testcases"]').click();
        
    } catch (error) {
        console.error('Error running code:', error);
        showToast(error.message || 'Failed to run code', 'error');
        displayRunError(error.message);
    } finally {
        runBtn.disabled = false;
        runBtn.innerHTML = '<i class="fas fa-play"></i> <span>Run Code</span>';
    }
}

function displayRunResult(result) {
    const output = document.getElementById('testcasesOutput');
    
    if (result.error) {
        output.innerHTML = `
            <div class="test-result failed">
                <div class="result-header">
                    <span style="color: #9ca3af; font-size: 13px;">Execution Error</span>
                    <span class="result-status status-failed">
                        <i class="fas fa-times-circle"></i>
                        Failed
                    </span>
                </div>
                <div class="result-details">
                    <div class="result-label">Error:</div>
                    <div class="result-value" style="color: #ef4444;">${result.error}</div>
                </div>
            </div>
        `;
    } else {
        output.innerHTML = `
            <div class="test-result passed">
                <div class="result-header">
                    <span style="color: #9ca3af; font-size: 13px;">Custom Test Case</span>
                    <span class="result-status status-passed">
                        <i class="fas fa-check-circle"></i>
                        Success
                    </span>
                </div>
                <div class="result-details">
                    <div class="result-label">Output:</div>
                    <div class="result-value">${result.output || '(empty output)'}</div>
                    <div class="result-label" style="margin-top: 12px;">Status:</div>
                    <div class="result-value">${result.status}</div>
                </div>
            </div>
        `;
    }
}

function displayRunError(error) {
    const output = document.getElementById('testcasesOutput');
    output.innerHTML = `
        <div class="test-result failed">
            <div class="result-header">
                <span style="color: #9ca3af; font-size: 13px;">Execution Error</span>
                <span class="result-status status-failed">
                    <i class="fas fa-times-circle"></i>
                    Failed
                </span>
            </div>
            <div class="result-details">
                <div class="result-label">Error:</div>
                <div class="result-value" style="color: #ef4444;">${error}</div>
            </div>
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
            showToast(`All test cases passed! +${result.total_points} points`, 'success');
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
        document.querySelector('[data-tab="results"]').click();
        
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
    const output = document.getElementById('resultsOutput');
    
    const passedCount = result.results.filter(r => r.passed).length;
    const totalCount = result.results.length;
    
    let html = `
        <div style="background: ${result.all_passed ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)'}; 
                    border: 1px solid ${result.all_passed ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}; 
                    border-radius: 8px; padding: 16px; margin-bottom: 16px;">
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
                <i class="fas ${result.all_passed ? 'fa-check-circle' : 'fa-times-circle'}" 
                   style="color: ${result.all_passed ? '#22c55e' : '#ef4444'}; font-size: 20px;"></i>
                <span style="color: ${result.all_passed ? '#22c55e' : '#ef4444'}; font-weight: 600; font-size: 16px;">
                    ${result.all_passed ? 'Accepted' : 'Wrong Answer'}
                </span>
            </div>
            <p style="color: #9ca3af; font-size: 13px;">
                ${passedCount} / ${totalCount} test cases passed
                ${result.all_passed ? ` • +${result.total_points} points` : ''}
            </p>
        </div>
    `;
    
    // tests
    result.results.forEach((test, idx) => {
        html += `
            <div class="test-result ${test.passed ? 'passed' : 'failed'}">
                <div class="result-header">
                    <span>Test Case ${idx + 1}</span>
                    <span class="result-status ${test.passed ? 'status-passed' : 'status-failed'}">
                        <i class="fas ${test.passed ? 'fa-check-circle' : 'fa-times-circle'}"></i>
                        ${test.passed ? 'Passed' : 'Failed'}
                    </span>
                </div>
                <div class="result-details">
                    <div class="result-label">Input:</div>
                    <div class="result-value">${test.input || '(empty)'}</div>
                    
                    <div class="result-label">Expected Output:</div>
                    <div class="result-value">${test.expected_output}</div>
                    
                    <div class="result-label">Your Output:</div>
                    <div class="result-value" style="color: ${test.passed ? '#22c55e' : '#ef4444'};">
                        ${test.actual_output || '(empty)'}
                    </div>
                    
                    ${test.error ? `
                        <div class="result-label">Error:</div>
                        <div class="result-value" style="color: #ef4444;">${test.error}</div>
                    ` : ''}
                </div>
            </div>
        `;
    });
    
    output.innerHTML = html;
}

function displaySubmitError(error) {
    const output = document.getElementById('resultsOutput');
    output.innerHTML = `
        <div class="test-result failed">
            <div class="result-header">
                <span style="color: #9ca3af; font-size: 13px;">Submission Error</span>
                <span class="result-status status-failed">
                    <i class="fas fa-times-circle"></i>
                    Failed
                </span>
            </div>
            <div class="result-details">
                <div class="result-label">Error:</div>
                <div class="result-value" style="color: #ef4444;">${error}</div>
            </div>
        </div>
    `;
}

// logout
function handleLogout() {
    localStorage.removeItem('firebaseToken');
    localStorage.removeItem('userData');
    window.location.href = '/auth';
}

// change lang
function initLanguageSelect() {
    document.getElementById('languageSelect').addEventListener('change', (e) => {
        const languageId = e.target.value;
        const mode = languageModes[languageId] || 'python';
        editor.setOption('mode', mode);
    });
}

// init
async function initProblemPage() {
    const authData = checkAuth();
    if (!authData) return;
    
    try {
        const problem = await fetchProblemDetail(PROBLEM_SLUG);
        
        if (!problem) {
            throw new Error('Problem not found');
        }
        
        renderProblem(problem);
        initResizer();
        initConsoleTabs();
        initLanguageSelect();
                
    } catch (error) {
        console.error('Error initializing problem page:', error);
        showToast(error.message || 'Failed to load problem', 'error');
    }
}


document.addEventListener('DOMContentLoaded', () => {
    initProblemPage();
    
    document.getElementById('runBtn')?.addEventListener('click', runCode);
    document.getElementById('submitBtn')?.addEventListener('click', submitCode);
    document.getElementById('logoutBtn')?.addEventListener('click', handleLogout);
});