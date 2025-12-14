import requests
import json
import re
import time
from typing import Any, Dict, List, Optional, Tuple, Union

PISTON_LANGUAGE_MAP = {
    71: {"lang": "python", "version": "3.10.0", "ext": "py"},
    63: {"lang": "javascript", "version": "18.15.0", "ext": "js"},
    62: {"lang": "java", "version": "15.0.2", "ext": "java"},
    54: {"lang": "c++", "version": "10.2.0", "ext": "cpp"}
}

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


#error Extraction

def extract_user_error(stderr: str, user_code: str, language_id: int) -> str:
    if not stderr:
        return ""
    
    stderr = stderr.replace('RUNTIME_ERROR:', '').strip()
    
    if language_id == 71:  
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
    
    elif language_id == 62:  
        lines = stderr.split('\n')
        
        for line in lines:
            if 'error:' in line.lower():
                line = re.sub(r'Main\.java:\d+: ', '', line)
                return line.strip()
            if 'Exception' in line:
                return line.strip()
        
        return lines[0].strip() if lines else stderr
    
    elif language_id == 54:  
        lines = stderr.split('\n')
        
        for line in lines:
            if 'error:' in line.lower():
                line = re.sub(r'/tmp/[^:]+:\d+:\d+: ', '', line)
                line = re.sub(r'main\.cpp:\d+:\d+: ', '', line)
                return line.strip()
        
        return lines[0].strip() if lines else stderr
    
    elif language_id == 63:  
        lines = stderr.split('\n')
        
        for line in lines:
            if any(err in line for err in ['Error:', 'TypeError:', 'ReferenceError:', 'SyntaxError:']):
                return line.strip()
        
        return lines[0].strip() if lines else stderr
    
    return stderr.split('\n')[0].strip() if stderr else stderr



def detect_function_name(boilerplate_code: str) -> str:
    """Extract function name from boilerplate."""
    if not boilerplate_code:
        return "solution"
    
    match = re.search(r'def\s+(\w+)\s*\(', boilerplate_code)
    if match:
        return match.group(1)
    
    match = re.search(r'(?:var|const|let)\s+(\w+)\s*=\s*function', boilerplate_code)
    if match:
        return match.group(1)
    
    match = re.search(r'function\s+(\w+)\s*\(', boilerplate_code)
    if match:
        return match.group(1)
    
    match = re.search(r'public\s+\w+\s+(\w+)\s*\(', boilerplate_code)
    if match:
        return match.group(1)
    
    match = re.search(r'(\w+)\s*\([^)]*\)', boilerplate_code)
    if match:
        name = match.group(1)
        if name not in ['class', 'struct', 'public', 'private', 'protected', 'virtual']:
            return name
    
    return "solution"


def infer_type_from_value(value: Any) -> str:
    """Infer parameter type from value."""
    if isinstance(value, bool):
        return 'boolean'
    elif isinstance(value, int):
        return 'int'
    elif isinstance(value, float):
        return 'float'
    elif isinstance(value, str):
        return 'string'
    elif isinstance(value, list):
        if not value:
            return 'array'
        if isinstance(value[0], list):
            return '2d_array'
        return 'array'
    return 'unknown'


# LANUAGE WRAPPERS

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


def generate_java_wrapper(user_code: str, test_input_json: dict, function_name: str) -> str:
    import re

    user_code = re.sub(r'\bclass\s+Main\b', 'class Solution', user_code)
    class_match = re.search(r'class\s+(\w+)', user_code)
    solution_class = class_match.group(1) if class_match else 'Solution'

    param_conversions = []
    param_calls = []

    def convert_param(name, value):
        if isinstance(value, int):
            return f"int {name} = {value};", name
        elif isinstance(value, float):
            return f"double {name} = {value};", name
        elif isinstance(value, str):
            escaped = value.replace('\\', '\\\\').replace('"', '\\"')
            return f'String {name} = "{escaped}";', name
        elif isinstance(value, bool):
            return f"boolean {name} = {str(value).lower()};", name
        elif isinstance(value, list):
            if all(isinstance(x, int) for x in value):
                return f"int[] {name} = {{{', '.join(map(str, value))}}};", name
            elif all(isinstance(x, str) for x in value):
                str_values = ', '.join(f'"{x}"' for x in value)
                return f'String[] {name} = {{{str_values}}};', name
            elif all(isinstance(x, list) for x in value):
                rows_str = ", ".join("{" + ", ".join(map(str, row)) + "}" for row in value)
                return f"int[][] {name} = {{{rows_str}}};", name
        return f"Object {name} = null;", name

    for param_name, value in test_input_json.items():
        conv, call = convert_param(param_name, value)
        param_conversions.append(f"            {conv}")
        param_calls.append(call)

    param_conversion_code = "\n".join(param_conversions)
    param_call_str = ", ".join(param_calls)

    wrapper = f'''
import java.util.*;

public class Main {{
    public static void main(String[] args) {{
        try {{
{param_conversion_code}

            {solution_class} solution = new {solution_class}();
            Object result = solution.{function_name}({param_call_str});
            System.out.println(toJson(result));

        }} catch (Exception e) {{
            System.err.println("RUNTIME_ERROR: " + e.getClass().getSimpleName() + ": " + e.getMessage());
            e.printStackTrace(System.err);
            System.exit(1);
        }}
    }}

    private static String toJson(Object obj) {{
        if (obj == null) return "null";
        if (obj instanceof String) return "\\""+escapeJson((String)obj)+"\\"";
        if (obj instanceof Number || obj instanceof Boolean) return obj.toString();
        if (obj.getClass().isArray()) return arrayToJson(obj);
        if (obj instanceof List) return arrayToJson(((List<?>)obj).toArray());
        if (obj instanceof Map) {{
            Map<?,?> map = (Map<?,?>)obj;
            StringBuilder sb = new StringBuilder("{{");
            int count = 0;
            for (Map.Entry<?,?> entry : map.entrySet()) {{
                if (count++ > 0) sb.append(",");
                sb.append("\\"").append(escapeJson(entry.getKey().toString())).append("\\":");
                sb.append(toJson(entry.getValue()));
            }}
            sb.append("}}");
            return sb.toString();
        }}
        return "\\""+escapeJson(obj.toString())+"\\"";
    }}

    private static String arrayToJson(Object arr) {{
        StringBuilder sb = new StringBuilder("[");
        int len = java.lang.reflect.Array.getLength(arr);
        for (int i = 0; i < len; i++) {{
            if (i > 0) sb.append(",");
            sb.append(toJson(java.lang.reflect.Array.get(arr, i)));
        }}
        sb.append("]");
        return sb.toString();
    }}

    private static String escapeJson(String str) {{
        if (str == null) return "";
        return str.replace("\\\\", "\\\\\\\\").replace('"', "\\\\\"")
                  .replace("\\n", "\\\\n").replace("\\r", "\\\\r").replace("\\t", "\\\\t");
    }}
}}

{user_code}
'''
    return wrapper




def generate_cpp_wrapper(user_code: str, test_input_json: Dict, 
                        function_name: str) -> str:
    param_conversions = []
    param_calls = []
    
    for param_name, value in test_input_json.items():
        param_type = infer_type_from_value(value)
        
        if param_type == 'int':
            param_conversions.append(f"    int {param_name} = {value};")
            param_calls.append(param_name)
        elif param_type == 'string':
            escaped = str(value).replace('"', '\\"')
            param_conversions.append(f'    string {param_name} = "{escaped}";')
            param_calls.append(param_name)
        elif param_type == 'array':
            if all(isinstance(x, int) for x in value):
                arr_str = "{" + ", ".join(map(str, value)) + "}"
                param_conversions.append(f"    vector<int> {param_name} = {arr_str};")
                param_calls.append(param_name)
        elif param_type == '2d_array':
            rows = ["{" + ", ".join(map(str, row)) + "}" for row in value]
            arr_str = "{" + ", ".join(rows) + "}"
            param_conversions.append(f"    vector<vector<int>> {param_name} = {arr_str};")
            param_calls.append(param_name)
    
    param_conversion_code = "\n".join(param_conversions)
    param_call_str = ", ".join(param_calls)
    
    wrapper = f'''#include <iostream>
#include <vector>
#include <string>
#include <sstream>
using namespace std;

{user_code}

string serialize(int val) {{ return to_string(val); }}
string serialize(bool val) {{ return val ? "true" : "false"; }}
string serialize(const string& val) {{ return "\\"" + val + "\\""; }}
string serialize(const vector<int>& arr) {{
    stringstream ss;
    ss << "[";
    for (size_t i = 0; i < arr.size(); i++) {{
        if (i > 0) ss << ",";
        ss << arr[i];
    }}
    ss << "]";
    return ss.str();
}}
string serialize(const vector<vector<int>>& arr) {{
    stringstream ss;
    ss << "[";
    for (size_t i = 0; i < arr.size(); i++) {{
        if (i > 0) ss << ",";
        ss << serialize(arr[i]);
    }}
    ss << "]";
    return ss.str();
}}

int main() {{
    try {{
{param_conversion_code}
        Solution solution;
        auto result = solution.{function_name}({param_call_str});
        cout << serialize(result) << endl;
    }} catch (const exception& e) {{
        cerr << "RUNTIME_ERROR: " << e.what() << endl;
        return 1;
    }}
    return 0;
}}
'''
    return wrapper


def generate_javascript_wrapper(user_code: str, test_input_json: Dict, 
                                function_name: str) -> str:
    user_code = user_code.strip()
    user_code = re.sub(r'var\s+\w+\s*=\s*function\s*\([^)]*\)\s*\{\s*\};?', '', user_code).strip()
    
    wrapper = f'''{user_code}

try {{
    const testInput = {json.dumps(test_input_json)};
    const params = Object.values(testInput);
    const result = {function_name}(...params);
    
    const jsonResult = JSON.stringify(result, (key, value) => {{
        if (value instanceof Set) return Array.from(value).sort();
        if (value === undefined) return null;
        return value;
    }});
    
    console.log(jsonResult);
}} catch (error) {{
    console.error(`RUNTIME_ERROR: ${{error.name}}: ${{error.message}}`);
    process.exit(1);
}}
'''
    return wrapper


def get_wrapper_generator(language_id: int):
    generators = {
        71: generate_python_wrapper,
        63: generate_javascript_wrapper,
        62: generate_java_wrapper,
        54: generate_cpp_wrapper
    }
    return generators.get(language_id, generate_python_wrapper)


# EXECUTE FUNCTION

def execute_code_piston(
    user_code: str,
    test_case_input_json: Dict,
    test_case_output_json: Any,
    language_id: int,
    boilerplate_code: str,
    problem_slug: Optional[str] = None,
    order_matters: bool = True,
    max_retries: int = 3
) -> Dict[str, Any]:
    """
    Execute code with Piston API.
    
    Returns:
        Dict with: status, passed, output, expected, actual_parsed, error
    """
    
    if language_id not in PISTON_LANGUAGE_MAP:
        return {
            'status': 'System Error',
            'passed': False,
            'output': '',
            'expected': test_case_output_json,
            'actual_parsed': None,
            'error': f'Unsupported language ID: {language_id}. Supported: Python(71), JS(63), Java(62), C++(54)',
            'execution_time': 0,
            'memory_used': 0
        }
    
    lang_config = PISTON_LANGUAGE_MAP[language_id]
    function_name = detect_function_name(boilerplate_code)
    wrapper_generator = get_wrapper_generator(language_id)
    
    try:
        wrapped_code = wrapper_generator(user_code, test_case_input_json, function_name)
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
        "language": lang_config["lang"],
        "version": lang_config["version"],
        "files": [{"name": f"main.{lang_config['ext']}", "content": wrapped_code}],
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
                    error = extract_user_error(compile_stderr, user_code, language_id)
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
                
                error = extract_user_error(error_msg, user_code, language_id)
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