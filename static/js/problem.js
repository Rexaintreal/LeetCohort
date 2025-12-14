// toast noti
function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icon = type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle';
    toast.innerHTML = `
        <div style="display: flex; align-items: center; gap: 12px;">
            <i class="fas ${icon}" style="font-size: 16px; color: ${type === 'success' ? '#4ade80' : '#f87171'};"></i>
            <span style="font-size: 14px; font-weight: 500; color: #d4d4d4;">${message}</span>
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

function initCodeEditor(boilerplateCode = '', language = 'python') {
    editor = CodeMirror.fromTextArea(document.getElementById('codeEditor'), {
        mode: language,
        theme: 'yonce',
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
    '54': 'text/x-c++src'        
};

const languageToBoilerplate = {
    '71': 'python',
    '63': 'javascript',
    '62': 'java',
    '54': 'cpp'
};

const languageNames = {
    '71': 'Python 3',
    '63': 'JavaScript',
    '62': 'Java',
    '54': 'C++'
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
    difficultyBadge.className = `difficulty-${problem.difficulty.toLowerCase()} px-3 py-1 rounded text-xs font-bold`;
    
    document.getElementById('problemDescription').innerHTML = formatDescription(problem);
    renderExamples(problem.sample_test_cases);
    renderHints(problem.hints);
    initCodeEditor(problem.boilerplate_code.python || '# Write your solution here\n', 'python');
}

function formatDescription(problem) {
    let html = '';
    
    const paragraphs = problem.description.split('\n\n').filter(p => p.trim());
    html += paragraphs.map(p => `<p>${p.trim()}</p>`).join('');
    
    if (problem.input_format) {
        html += `
            <div style="margin-top: 24px; padding: 16px; background: rgba(126, 30, 231, 0.05); border-radius: 8px; border-left: 3px solid #7E1EE7;">
                <div style="font-weight: 600; color: #7E1EE7; margin-bottom: 8px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em;">Input Format</div>
                <div style="color: #cccccc; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">${problem.input_format}</div>
            </div>
        `;
    }
    
    if (problem.output_format) {
        html += `
            <div style="margin-top: 12px; padding: 16px; background: rgba(126, 30, 231, 0.05); border-radius: 8px; border-left: 3px solid #7E1EE7;">
                <div style="font-weight: 600; color: #7E1EE7; margin-bottom: 8px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em;">Output Format</div>
                <div style="color: #cccccc; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">${problem.output_format}</div>
            </div>
        `;
    }
    
    if (problem.constraints) {
        html += `
            <div style="margin-top: 24px;">
                <div style="font-weight: 600; color: #9ca3af; margin-bottom: 12px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em;">
                    <i class="fas fa-info-circle" style="color: #7E1EE7;"></i> Constraints
                </div>
                <div style="color: #cccccc; font-size: 14px; line-height: 1.8; white-space: pre-wrap;">${problem.constraints}</div>
            </div>
        `;
    }
    
    if (problem.time_complexity || problem.space_complexity) {
        html += `<div style="margin-top: 24px; display: flex; gap: 16px;">`;
        if (problem.time_complexity) {
            html += `
                <div style="flex: 1; padding: 12px; background: rgba(34, 197, 94, 0.05); border-radius: 6px; border: 1px solid rgba(34, 197, 94, 0.2);">
                    <div style="font-size: 11px; color: #22c55e; font-weight: 600; margin-bottom: 4px;">EXPECTED TIME</div>
                    <div style="color: #cccccc; font-size: 14px; font-weight: 600;">${problem.time_complexity}</div>
                </div>
            `;
        }
        if (problem.space_complexity) {
            html += `
                <div style="flex: 1; padding: 12px; background: rgba(59, 130, 246, 0.05); border-radius: 6px; border: 1px solid rgba(59, 130, 246, 0.2);">
                    <div style="font-size: 11px; color: #3b82f6; font-weight: 600; margin-bottom: 4px;">EXPECTED SPACE</div>
                    <div style="color: #cccccc; font-size: 14px; font-weight: 600;">${problem.space_complexity}</div>
                </div>
            `;
        }
        html += `</div>`;
    }
    
    return html;
}

function renderExamples(testCases) {
    const container = document.getElementById('examplesContainer');
    
    if (!testCases || testCases.length === 0) {
        container.innerHTML = '<p style="color: #9ca3af; font-size: 14px;">No examples available</p>';
        return;
    }
    
    container.innerHTML = testCases.map((tc, idx) => `
        <div class="example-box">
            <div class="example-label">Example ${idx + 1}</div>
            <div class="example-content"><strong>Input:</strong> ${tc.input}
<strong>Output:</strong> ${tc.expected_output}${tc.explanation ? '\n\n<strong>Explanation:</strong> ' + tc.explanation : ''}</div>
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

function initLanguageSelect() {
    const select = document.getElementById('languageSelect');
    
    select.addEventListener('change', (e) => {
        const languageId = e.target.value;
        
        if (!languageModes[languageId]) {
            showToast('This language is not supported', 'error');
            select.value = '71'; 
            return;
        }
        
        const mode = languageModes[languageId];
        editor.setOption('mode', mode);
        
        const boilerplateKey = languageToBoilerplate[languageId];
        if (boilerplateKey && currentProblem && currentProblem.boilerplate_code[boilerplateKey]) {
            editor.setValue(currentProblem.boilerplate_code[boilerplateKey]);
        } else {
            const langName = languageNames[languageId];
            if (languageId === '62' || languageId === '54') {
                editor.setValue(`// ${langName} solution\n`);
            } else {
                editor.setValue(`// ${langName} solution\n`);
            }
        }
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
    
    if (![71, 63, 62, 54].includes(languageId)) {
        showToast('This language is not currently supported', 'error');
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
                language_id: languageId
            })
        });
        
        const result = await response.json();
        
        if (!response.ok) {
            throw new Error(result.error || 'Failed to run code');
        }
        
        displayRunResults(result);
        
        if (result.all_passed) {
            showToast('All sample test cases passed! ✓', 'success');
        } else {
            showToast('Some sample test cases failed', 'error');
        }
        
        document.querySelector('[data-tab="results"]').click();
        
    } catch (error) {
        console.error('Error running code:', error);
        showToast(error.message || 'Failed to run code', 'error');
        displayRunError(error.message);
    } finally {
        runBtn.disabled = false;
        runBtn.innerHTML = '<i class="fas fa-play"></i> <span>Run</span>';
    }
}

function displayRunResults(result) {
    const output = document.getElementById('resultsOutput');
    
    const passedCount = result.results.filter(r => r.passed).length;
    const totalCount = result.results.length;
    
    let html = `
        <div style="background: ${result.all_passed ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)'}; 
                    border: 1px solid ${result.all_passed ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}; 
                    border-radius: 8px; padding: 16px; margin-bottom: 16px;">
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 10px;">
                <i class="fas ${result.all_passed ? 'fa-check-circle' : 'fa-times-circle'}" 
                   style="color: ${result.all_passed ? '#4ade80' : '#f87171'}; font-size: 20px;"></i>
                <span style="color: ${result.all_passed ? '#4ade80' : '#f87171'}; font-weight: 700; font-size: 16px;">
                    ${result.all_passed ? 'All Sample Tests Passed' : 'Sample Tests Failed'}
                </span>
            </div>
            <p style="color: #9ca3af; font-size: 14px;">
                ${passedCount} / ${totalCount} sample test cases passed
            </p>
        </div>
    `;
    
    result.results.forEach((test, idx) => {
        const statusColor = test.passed ? '#4ade80' : '#f87171';
        const statusIcon = test.passed ? 'fa-check-circle' : 'fa-times-circle';
        
        html += `
            <div class="test-result ${test.passed ? 'passed' : 'failed'}">
                <div class="result-header">
                    <span style="color: #d4d4d4;">Sample Test Case ${idx + 1}</span>
                    <span class="result-status ${test.passed ? 'status-passed' : 'status-failed'}">
                        <i class="fas ${statusIcon}"></i>
                        ${test.status}
                    </span>
                </div>
                <div class="result-details">
                    <div class="result-label">Input:</div>
                    <div class="result-value">${test.input || '(empty)'}</div>
                    
                    <div class="result-label">Expected Output:</div>
                    <div class="result-value">${test.expected_output}</div>
                    
                    <div class="result-label">Your Output:</div>
                    <div class="result-value" style="color: ${statusColor};">
                        ${test.actual_output || '(empty)'}
                    </div>
                    
                    ${test.explanation ? `
                        <div class="result-label">Explanation:</div>
                        <div class="result-value">${test.explanation}</div>
                    ` : ''}
                    
                    ${test.error ? `
                        <div class="result-label">Error:</div>
                        <div class="result-value" style="color: #f87171; white-space: pre-wrap; font-family: 'Courier New', monospace;">${test.error}</div>
                    ` : ''}
                </div>
            </div>
        `;
    });
    
    output.innerHTML = html;
}

function displayRunError(error) {
    const output = document.getElementById('resultsOutput');
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
                <div class="result-value" style="color: #f87171;">${error}</div>
            </div>
        </div>
    `;
}

// submit
async function submitCode() {
    const authData = checkAuth();
    if (!authData) return;
    
    const code = editor.getValue();
    const languageId = parseInt(document.getElementById('languageSelect').value);
    
    if (!code.trim()) {
        showToast('Please write some code first', 'error');
        return;
    }
    
    if (![71, 63, 62, 54].includes(languageId)) {
        showToast('This language is not currently supported', 'error');
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
            showToast(`🎉 All test cases passed! +${result.total_points} points`, 'success');
            
            const userData = JSON.parse(localStorage.getItem('userData'));
            if (!userData.solved_problems.includes(currentProblem.id)) {
                userData.solved_problems.push(currentProblem.id);
                userData.problems_solved++;
                userData.points += result.total_points;
                localStorage.setItem('userData', JSON.stringify(userData));
            }
        } else {
            showToast(`${result.verdict} - Try again!`, 'error');
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
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 10px;">
                <i class="fas ${result.all_passed ? 'fa-check-circle' : 'fa-times-circle'}" 
                   style="color: ${result.all_passed ? '#4ade80' : '#f87171'}; font-size: 20px;"></i>
                <span style="color: ${result.all_passed ? '#4ade80' : '#f87171'}; font-weight: 700; font-size: 16px;">
                    ${result.verdict}
                </span>
            </div>
            <p style="color: #9ca3af; font-size: 14px;">
                ${passedCount} / ${totalCount} test cases passed
                ${result.all_passed ? ` • +${result.total_points} points` : ''}
            </p>
        </div>
    `;
    
    result.results.forEach((test, idx) => {
        const statusColor = test.passed ? '#4ade80' : '#f87171';
        const statusIcon = test.passed ? 'fa-check-circle' : 'fa-times-circle';
        
        html += `
            <div class="test-result ${test.passed ? 'passed' : 'failed'}">
                <div class="result-header">
                    <span style="color: #d4d4d4;">Test Case ${idx + 1} ${test.is_sample ? '(Sample)' : '(Hidden)'}</span>
                    <span class="result-status ${test.passed ? 'status-passed' : 'status-failed'}">
                        <i class="fas ${statusIcon}"></i>
                        ${test.status}
                    </span>
                </div>
                <div class="result-details">
                    ${test.is_sample ? `
                        <div class="result-label">Input:</div>
                        <div class="result-value">${test.input || '(empty)'}</div>
                        
                        <div class="result-label">Expected:</div>
                        <div class="result-value">${test.expected_output}</div>
                        
                        <div class="result-label">Your Output:</div>
                        <div class="result-value" style="color: ${statusColor};">
                            ${test.actual_output || '(empty)'}
                        </div>
                    ` : `
                        <div style="color: #9ca3af; font-size: 13px; font-style: italic;">
                            Hidden test case - details not shown
                        </div>
                    `}
                    
                    ${test.error ? `
                        <div class="result-label">Error:</div>
                        <div class="result-value" style="color: #f87171; white-space: pre-wrap; font-family: 'Courier New', monospace;">${test.error}</div>
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
                <div class="result-value" style="color: #f87171;">${error}</div>
            </div>
        </div>
    `;
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

function initConsoleResizer() {
    const consoleResizer = document.getElementById('consoleResizer');
    const consoleContainer = document.getElementById('consoleContainer');
    let isResizing = false;
    let startY = 0;
    let startHeight = 0;

    consoleResizer.addEventListener('mousedown', (e) => {
        isResizing = true;
        startY = e.clientY;
        startHeight = consoleContainer.offsetHeight;
        consoleResizer.classList.add('resizing');
        document.body.style.cursor = 'row-resize';
        document.body.style.userSelect = 'none';
    });

    document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;
        
        const delta = startY - e.clientY;
        const newHeight = startHeight + delta;
        const rightPanel = document.querySelector('.right-panel');
        const maxHeight = rightPanel.offsetHeight - 200;
        
        if (newHeight >= 150 && newHeight <= maxHeight) {
            consoleContainer.style.height = `${newHeight}px`;
        }
    });

    document.addEventListener('mouseup', () => {
        if (isResizing) {
            isResizing = false;
            consoleResizer.classList.remove('resizing');
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
            throw new Error('Problem not found');
        }
        
        renderProblem(problem);
        initResizer();
        initConsoleResizer();
        initConsoleTabs();
        initLanguageSelect();
        document.getElementById('consoleContainer').style.height = '280px';
                
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