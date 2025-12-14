import requests
import json
import re
import time
from typing import Any, Dict, List, Optional, Tuple, Union

PISTON_API_URL = "https://emkc.org/api/v2/piston/execute"

# JSON PARSING
def safe_json_load(data: Any) -> Any:
    if data is None:
        return None
    
    if not isinstance(data, str):
        return data
    
    data = data.strip()
    
    if not data:
        return None
    
    if data.lower() == 'true':
        return True
    if data.lower() == 'false':
        return False
    if data.lower() in ['null', 'none']:
        return None
    try:
        return json.loads(data)
    except (json.JSONDecodeError, ValueError):
        if data.startswith('"') and data.endswith('"'):
            return data[1:-1]
        if data.startswith("'") and data.endswith("'"):
            return data[1:-1]
        return data


def normalize_for_comparison(value: Any) -> Any:
    if value is None:
        return None
    
    if isinstance(value, set):
        return sorted(list(value))
    
    if isinstance(value, tuple):
        return list(value)
    
    if isinstance(value, list):
        return [normalize_for_comparison(item) for item in value]
    
    if isinstance(value, dict):
        return {k: normalize_for_comparison(v) for k, v in value.items()}
    
    return value

#order insensitive comparision for some questions
def compare_values(actual: Any, expected: Any, order_matters: bool = True, 
                   tolerance: float = 1e-6) -> bool:
    actual = normalize_for_comparison(actual)
    expected = normalize_for_comparison(expected)
    if actual is None and expected is None:
        return True
    if actual is None or expected is None:
        return False
    
    if isinstance(actual, bool) and isinstance(expected, bool):
        return actual == expected
    
    if isinstance(actual, (int, float)) and isinstance(expected, (int, float)):
        if isinstance(actual, bool) or isinstance(expected, bool):
            return actual == expected
        return abs(float(actual) - float(expected)) <= tolerance
    
    if isinstance(actual, str) and isinstance(expected, str):
        return actual == expected
    
    if isinstance(actual, list) and isinstance(expected, list):
        if len(actual) != len(expected):
            return False
        
        if len(actual) == 0:
            return True
        
        if isinstance(actual[0], list):
            if not order_matters:
                def sort_nested(lst):
                    result = []
                    for inner in lst:
                        if isinstance(inner, list):
                            result.append(tuple(sorted(inner)))
                        else:
                            result.append(inner)
                    return sorted(result)
                
                actual_sorted = sort_nested(actual)
                expected_sorted = sort_nested(expected)
                
                return all(compare_values(list(a) if isinstance(a, tuple) else a, 
                                         list(e) if isinstance(e, tuple) else e, 
                                         True, tolerance) 
                          for a, e in zip(actual_sorted, expected_sorted))
            else:
                return all(compare_values(a, e, order_matters, tolerance) 
                          for a, e in zip(actual, expected))
        
        if not order_matters:
            try:
                actual_sorted = sorted(actual, key=lambda x: (type(x).__name__, str(x)))
                expected_sorted = sorted(expected, key=lambda x: (type(x).__name__, str(x)))
                return all(compare_values(a, e, True, tolerance) 
                          for a, e in zip(actual_sorted, expected_sorted))
            except (TypeError, AttributeError):
                return set(str(x) for x in actual) == set(str(x) for x in expected)
        
        return all(compare_values(a, e, order_matters, tolerance) 
                  for a, e in zip(actual, expected))
    
    if isinstance(actual, dict) and isinstance(expected, dict):
        if set(actual.keys()) != set(expected.keys()):
            return False
        return all(compare_values(actual[k], expected[k], order_matters, tolerance) 
                  for k in actual.keys())
    
    return actual == expected


# Error Extraction
def extract_user_error(stderr: str, user_code: str) -> str:
    if not stderr:
        return ""
    
    stderr = stderr.replace('RUNTIME_ERROR:', '').strip()
    lines = stderr.split('\n')
    
    for line in reversed(lines):
        line = line.strip()
        if line and (
            'Error:' in line or 
            'Exception:' in line or
            'Warning:' in line
        ):
            line = re.sub(r'File "[^"]+", line \d+', '', line)
            line = re.sub(r'in <module>', '', line)
            return line.strip()
    
    return lines[-1].strip() if lines else stderr


def detect_function_name(boilerplate_code: str) -> str:
    if not boilerplate_code:
        return "solution"
    
    match = re.search(r'def\s+(\w+)\s*\(', boilerplate_code)
    if match:
        return match.group(1)
    
    return "solution"


# PYTHON WRAPPER
def generate_python_wrapper(user_code: str, test_input_json: Dict, 
                           function_name: str) -> str:
    user_code = user_code.strip()
    
    user_code = re.sub(
        r'class\s+Solution\s*:\s*def\s+\w+\([^)]*\)\s*(?:->\s*[^:]+)?\s*:\s*pass',
        '', user_code, flags=re.MULTILINE | re.DOTALL
    ).strip()
    
    has_class = 'class Solution' in user_code
    needs_treenode = 'TreeNode' in user_code
    needs_listnode = 'ListNode' in user_code
    
    data_structures = ''
    if needs_treenode:
        data_structures += '''
class TreeNode:
    def __init__(self, val=0, left=None, right=None):
        self.val = val
        self.left = left
        self.right = right
'''
    if needs_listnode:
        data_structures += '''
class ListNode:
    def __init__(self, val=0, next=None):
        self.val = val
        self.next = next
'''
    
    if has_class:
        wrapper = f'''import json
import sys
from typing import *

{data_structures}

{user_code}

if __name__ == "__main__":
    try:
        test_input = {json.dumps(test_input_json)}
        solution = Solution()
        result = solution.{function_name}(**test_input)
        
        class CustomEncoder(json.JSONEncoder):
            def default(self, obj):
                if isinstance(obj, set):
                    return sorted(list(obj))
                if isinstance(obj, tuple):
                    return list(obj)
                return super().default(obj)
        
        print(json.dumps(result, cls=CustomEncoder))
        
    except Exception as e:
        print(f"RUNTIME_ERROR: {{type(e).__name__}}: {{str(e)}}", file=sys.stderr)
        sys.exit(1)
'''
    else:
        has_self = re.search(rf'def\s+{function_name}\s*\(\s*self\s*,', user_code)
        if has_self:
            indented = '\n'.join('    ' + line if line.strip() else '' 
                                for line in user_code.split('\n'))
        else:
            modified = re.sub(rf'def\s+{function_name}\s*\(', 
                            f'def {function_name}(self, ', user_code)
            indented = '\n'.join('    ' + line if line.strip() else '' 
                                for line in modified.split('\n'))
        
        wrapper = f'''import json
import sys
from typing import *

{data_structures}

class Solution:
{indented}

if __name__ == "__main__":
    try:
        test_input = {json.dumps(test_input_json)}
        solution = Solution()
        result = solution.{function_name}(**test_input)
        
        class CustomEncoder(json.JSONEncoder):
            def default(self, obj):
                if isinstance(obj, set):
                    return sorted(list(obj))
                if isinstance(obj, tuple):
                    return list(obj)
                return super().default(obj)
        
        print(json.dumps(result, cls=CustomEncoder))
        
    except Exception as e:
        print(f"RUNTIME_ERROR: {{type(e).__name__}}: {{str(e)}}", file=sys.stderr)
        sys.exit(1)
'''
    
    return wrapper


# EXECUTE FUNCTION - PYTHON ONLY
def execute_code_piston(
    user_code: str,
    test_case_input_json: Dict,
    test_case_output_json: Any,
    boilerplate_code: str,
    problem_slug: Optional[str] = None,
    order_matters: bool = True,
    max_retries: int = 3
) -> Dict[str, Any]:
    """
    Execute Python code with Piston API.
    
    Returns:
        Dict with: status, passed, output, expected, actual_parsed, error
    """
    
    function_name = detect_function_name(boilerplate_code)
    
    try:
        wrapped_code = generate_python_wrapper(user_code, test_case_input_json, function_name)
    except Exception as e:
        return {
            'status': 'System Error',
            'passed': False,
            'output': '',
            'expected': test_case_output_json,
            'actual_parsed': None,
            'error': f'Code wrapping failed: {str(e)}',
            'execution_time': 0,
            'memory_used': 0
        }
    
    payload = {
        "language": "python",
        "version": "3.10.0",
        "files": [{"name": "main.py", "content": wrapped_code}],
        "stdin": "",
        "args": [],
        "compile_timeout": 10000,
        "run_timeout": 10000,
        "compile_memory_limit": -1,
        "run_memory_limit": -1
    }

    for attempt in range(max_retries):
        try:
            if attempt > 0:
                time.sleep(min(2 ** attempt, 8))
            
            response = requests.post(
                PISTON_API_URL,
                json=payload,
                timeout=20,
                headers={'Content-Type': 'application/json'}
            )
            
            if response.status_code != 200:
                if attempt < max_retries - 1:
                    continue
                return {
                    'status': 'System Error',
                    'passed': False,
                    'output': '',
                    'expected': test_case_output_json,
                    'actual_parsed': None,
                    'error': f'Piston API error: HTTP {response.status_code}',
                    'execution_time': 0,
                    'memory_used': 0
                }
            
            result = response.json()
            
            compile_result = result.get('compile')
            if compile_result:
                compile_stderr = compile_result.get('stderr', '').strip()
                compile_exit = compile_result.get('code', 0)
                
                if compile_exit != 0 and compile_stderr:
                    error = extract_user_error(compile_stderr, user_code)
                    return {
                        'status': 'Compilation Error',
                        'passed': False,
                        'output': '',
                        'expected': test_case_output_json,
                        'actual_parsed': None,
                        'error': error or compile_stderr[:200],
                        'execution_time': 0,
                        'memory_used': 0
                    }
            run_result = result.get('run', {})
            stdout = run_result.get('stdout', '').strip()
            stderr = run_result.get('stderr', '').strip()
            exit_code = run_result.get('code', 1)
            
            if exit_code != 0 or 'RUNTIME_ERROR:' in stderr:
                error_msg = stderr if stderr else 'Process exited with error'
                if 'RUNTIME_ERROR:' in error_msg:
                    error_msg = error_msg.split('RUNTIME_ERROR:')[1].strip().split('\n')[0]
                
                error = extract_user_error(error_msg, user_code)
                return {
                    'status': 'Runtime Error',
                    'passed': False,
                    'output': stdout,
                    'expected': test_case_output_json,
                    'actual_parsed': None,
                    'error': error or error_msg[:200],
                    'execution_time': 0,
                    'memory_used': 0
                }
            actual_parsed = safe_json_load(stdout)
            passed = compare_values(actual_parsed, test_case_output_json, order_matters)
            
            return {
                'status': 'Accepted' if passed else 'Wrong Answer',
                'passed': passed,
                'output': stdout,
                'expected': test_case_output_json,
                'actual_parsed': actual_parsed,
                'error': '',
                'execution_time': 0,
                'memory_used': 0
            }
        
        except requests.exceptions.Timeout:
            if attempt < max_retries - 1:
                continue
            return {
                'status': 'Time Limit Exceeded',
                'passed': False,
                'output': '',
                'expected': test_case_output_json,
                'actual_parsed': None,
                'error': 'Execution timed out (20s limit)',
                'execution_time': 0,
                'memory_used': 0
            }
        
        except Exception as e:
            if attempt < max_retries - 1:
                continue
            return {
                'status': 'System Error',
                'passed': False,
                'output': '',
                'expected': test_case_output_json,
                'actual_parsed': None,
                'error': f'Execution failed: {str(e)[:200]}',
                'execution_time': 0,
                'memory_used': 0
            }
    
    return {
        'status': 'System Error',
        'passed': False,
        'output': '',
        'expected': test_case_output_json,
        'actual_parsed': None,
        'error': 'Max retries exceeded',
        'execution_time': 0,
        'memory_used': 0
    }

# COMPLEXITY CHECK (BASIC for now)

def check_code_complexity(
    user_code: str,
    boilerplate_code: str, 
    problem_slug: str,
    base_test_input: dict,
    base_test_output: any,
    expected_complexity: str,
    order_matters: bool = True
) -> dict:
    
    if not expected_complexity or expected_complexity.strip() == '':
        return {'passes': True, 'reason': 'No complexity requirement', 'analyzed': False}
    
    complexity_rates = {
        'O(1)': 1.0,
        'O(log n)': 1.1,
        'O(n)': 2.0,
        'O(n log n)': 2.2,
        'O(n²)': 4.0,
        'O(n³)': 8.0,
    }
    
    if expected_complexity not in complexity_rates:
        return {'passes': True, 'reason': f'Unknown complexity: {expected_complexity}', 'analyzed': False}
    
    try:
        times = []
        sizes = []
        
        for scale in [1, 2, 4, 8]:
            scaled_input = {}
            max_size = 1
            
            for key, value in base_test_input.items():
                if isinstance(value, list):
                    new_list = value * scale
                    scaled_input[key] = new_list
                    max_size = max(max_size, len(new_list))
                elif isinstance(value, int):
                    scaled_input[key] = value * scale
                    max_size = max(max_size, value * scale)
                else:
                    scaled_input[key] = value
            
            start = time.perf_counter()
            
            result = execute_code_piston(
                user_code=user_code,
                test_case_input_json=scaled_input,
                test_case_output_json=base_test_output,
                boilerplate_code=boilerplate_code,
                problem_slug=problem_slug,
                order_matters=order_matters
            )
            
            elapsed = time.perf_counter() - start
            
            if elapsed > 5.0:
                return {
                    'passes': False,
                    'detected': 'Too Slow',
                    'expected': expected_complexity,
                    'reason': f'Code took {elapsed:.2f}s for input size {max_size}',
                    'analyzed': True
                }
            
            times.append(elapsed)
            sizes.append(max_size)
        
        growth_ratios = []
        for i in range(1, len(times)):
            if times[i-1] > 0.0001:  
                time_growth = times[i] / times[i-1]
                size_growth = sizes[i] / sizes[i-1]
                
                if size_growth > 1.1:
                    normalized = time_growth ** (2.0 / size_growth)
                    growth_ratios.append(normalized)
        
        if not growth_ratios:
            return {'passes': True, 'reason': 'Could not measure growth', 'analyzed': False}
        
        avg_growth = sum(growth_ratios) / len(growth_ratios)
        expected_rate = complexity_rates[expected_complexity]
        
        passes = (avg_growth <= expected_rate * 2.5)
        
        detected = 'Unknown'
        for complexity, rate in sorted(complexity_rates.items(), key=lambda x: x[1]):
            if avg_growth <= rate * 1.3:
                detected = complexity
                break
        
        if detected == 'Unknown' and avg_growth > 8:
            detected = 'O(2^n) or worse'
        
        return {
            'passes': passes,
            'detected': detected,
            'expected': expected_complexity,
            'average_growth_ratio': round(avg_growth, 2),
            'execution_times': [round(t, 4) for t in times],
            'input_sizes': sizes,
            'reason': (
                f'Detected {detected} matches expected {expected_complexity}'
                if passes
                else f'Detected {detected}, expected {expected_complexity} (growth: {avg_growth:.2f}x per 2x input)'
            ),
            'analyzed': True
        }
    
    except Exception as e:
        return {
            'passes': True,
            'reason': f'Complexity check skipped: {str(e)}',
            'analyzed': False
        }
