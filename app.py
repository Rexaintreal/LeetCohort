from flask import Flask, Response, render_template, request, jsonify, url_for
from flask_cors import CORS
import firebase_admin
from firebase_admin import credentials, firestore
from firebase_admin import auth as firebase_auth
from datetime import datetime
import os
from functools import wraps
import sqlite3
import requests
from werkzeug.utils import secure_filename
import uuid
from PIL import Image
from concurrent.futures import ThreadPoolExecutor, as_completed
from execution import execute_code_piston, safe_json_load

app = Flask(__name__)
CORS(app)

# upload configs
UPLOAD_FOLDER = 'static/uploads'
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg'}
MAX_FILE_SIZE = 5 * 1024 * 1024  
MAX_IMAGE_DIMENSION = 500 

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = MAX_FILE_SIZE

os.makedirs(UPLOAD_FOLDER, exist_ok=True)

cred = credentials.Certificate('firebase-admin-sdk.json')
firebase_admin.initialize_app(cred)
db = firestore.client()

executor = ThreadPoolExecutor(max_workers=5)

# Helper Functions

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def token_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({'error': 'No token provided'}), 401
        
        id_token = auth_header.split('Bearer ')[1]
        try:
            decoded_token = firebase_auth.verify_id_token(id_token)
            request.user = decoded_token
            return f(*args, **kwargs)
        except Exception as e:
            print(f"Token verification failed: {e}")
            return jsonify({'error': 'Invalid token'}), 401
    
    return decorated_function

def get_db_connection():
    conn = sqlite3.connect('db/problems.db')
    conn.row_factory = sqlite3.Row
    return conn


# Image proxy route
@app.route("/proxy-image")
def proxy_image():
    url = request.args.get("url")
    if not url:
        return "Missing URL", 400

    r = requests.get(url, stream=True)

    return Response(
        r.content,
        content_type=r.headers.get("Content-Type", "image/jpeg")
    )

# Public Routes

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/auth')
def auth():
    return render_template('auth.html')

@app.route('/home')
def home():
    return render_template('home.html')

@app.route('/leaderboard')
def leaderboard():
    return render_template('leaderboard.html')

@app.route('/profile/<username>')
def profile(username):
    return render_template('profile.html', username=username)

@app.route('/settings')
def settings():
    return render_template('settings.html')

@app.route('/problem/<slug>')
def problem_detail(slug):
    return render_template('problem.html', slug=slug)

# API routes

@app.route('/api/firebase-config')
def firebase_config():
    config = {
        'apiKey': os.getenv('FIREBASE_API_KEY'),
        'authDomain': os.getenv('FIREBASE_AUTH_DOMAIN'),
        'projectId': os.getenv('FIREBASE_PROJECT_ID'),
        'storageBucket': os.getenv('FIREBASE_STORAGE_BUCKET'),
        'messagingSenderId': os.getenv('FIREBASE_MESSAGING_SENDER_ID'),
        'appId': os.getenv('FIREBASE_APP_ID'),
        'measurementId': os.getenv('FIREBASE_MEASUREMENT_ID')
    }
    return jsonify(config)

##auth

@app.route('/api/auth/verify', methods=['POST'])
def verify_and_create_user():
    try:
        data = request.json
        id_token = data.get('idToken')
        
        if not id_token:
            return jsonify({'error': 'No token provided'}), 400
        
        decoded_token = firebase_auth.verify_id_token(id_token)
        uid = decoded_token['uid']
        user = firebase_auth.get_user(uid)
        
        user_ref = db.collection('users').document(uid)
        user_doc = user_ref.get()
        
        if user_doc.exists:
            user_ref.update({
                'last_active': datetime.now()
            })
            user_data = user_doc.to_dict()
        else:
            user_data = {
                'uid': uid,
                'email': user.email,
                'name': user.display_name or user.email.split('@')[0],
                'picture': user.photo_url,
                'points': 0,
                'problems_solved': 0,
                'solved_problems': [],
                'created_at': datetime.now(),
                'last_active': datetime.now()
            }
            user_ref.set(user_data)

        response_data = {
            'uid': user_data['uid'],
            'email': user_data['email'],
            'name': user_data['name'],
            'picture': user_data.get('picture'),
            'points': user_data['points'],
            'problems_solved': user_data['problems_solved'],
            'is_new_user': not user_doc.exists
        }
        
        return jsonify({
            'success': True,
            'user': response_data
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/user/<uid>', methods=['GET'])
@token_required
def get_user(uid):
    try:
        if request.user['uid'] != uid:
            return jsonify({'error': 'Unauthorized'}), 403
        
        user_ref = db.collection('users').document(uid)
        user_doc = user_ref.get()
        
        if not user_doc.exists:
            return jsonify({'error': 'User not found'}), 404
        
        user_data = user_doc.to_dict()
        if 'created_at' in user_data and user_data['created_at']:
            user_data['created_at'] = user_data['created_at'].isoformat()
        if 'last_active' in user_data and user_data['last_active']:
            user_data['last_active'] = user_data['last_active'].isoformat()
        
        return jsonify(user_data), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


##problem

@app.route('/api/problem/<slug>/submit', methods=['POST'])
@token_required
def submit_solution(slug):

    conn = None
    try:
        data = request.json
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        code = data.get('code', '').strip()
        language_id = data.get('language_id', 71)
        
        if not code:
            return jsonify({'error': 'No code provided'}), 400
        
        if language_id not in [71, 63, 62, 54]:
            return jsonify({'error': f'Unsupported language: {language_id}'}), 400
        
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("""
            SELECT id, title, points, boilerplate_python, boilerplate_java,
                   boilerplate_cpp, boilerplate_javascript, order_matters
            FROM problems 
            WHERE slug = ?
        """, (slug,))
        problem_row = cur.fetchone()
        
        if not problem_row:
            return jsonify({'error': 'Problem not found'}), 404
        
        problem_id = problem_row['id']
        problem_points = problem_row['points']
        order_matters = bool(problem_row['order_matters']) if problem_row['order_matters'] is not None else True
        
        boilerplate_map = {
            71: problem_row['boilerplate_python'],
            63: problem_row['boilerplate_javascript'],
            62: problem_row['boilerplate_java'],
            54: problem_row['boilerplate_cpp']
        }
        boilerplate_code = boilerplate_map.get(language_id, problem_row['boilerplate_python'])
        
        cur.execute("""
            SELECT id, input, expected_output, input_json, expected_output_json,
                   points, is_sample, display_order
            FROM test_cases
            WHERE problem_id = ?
            ORDER BY display_order
        """, (problem_id,))
        test_cases = cur.fetchall()
        
        if not test_cases:
            return jsonify({'error': 'No test cases found'}), 404
        
        prepared_tests = []
        for tc in test_cases:
            try:
                if tc['input_json']:
                    test_input = safe_json_load(tc['input_json'])
                else:
                    test_input = safe_json_load(tc['input']) if tc['input'] else {}
                
                if not isinstance(test_input, dict):
                    test_input = {'input': test_input}
                
                if tc['expected_output_json']:
                    test_output = safe_json_load(tc['expected_output_json'])
                else:
                    test_output = safe_json_load(tc['expected_output'])
                
                prepared_tests.append({
                    'id': tc['id'],
                    'input': test_input,
                    'output': test_output,
                    'points': tc['points'],
                    'is_sample': bool(tc['is_sample']),
                    'original_input': tc['input'],
                    'original_output': tc['expected_output']
                })
            
            except Exception as e:
                print(f"Warning: Failed to parse test case {tc['id']}: {e}")
                continue
        
        if not prepared_tests:
            return jsonify({'error': 'No valid test cases found'}), 500
        
        def execute_test(test):
            result = execute_code_piston(
                user_code=code,
                test_case_input_json=test['input'],
                test_case_output_json=test['output'],
                language_id=language_id,
                boilerplate_code=boilerplate_code,
                problem_slug=slug,
                order_matters=order_matters
            )
            result['test_id'] = test['id']
            result['test_points'] = test['points']
            result['is_sample'] = test['is_sample']
            result['original_input'] = test['original_input']
            result['original_output'] = test['original_output']
            return result
        
        futures = {executor.submit(execute_test, test): test for test in prepared_tests}
        
        results = []
        all_passed = True
        actual_points_earned = 0  
        first_failure_status = None
        
        for future in as_completed(futures):
            try:
                result = future.result(timeout=30)
                
                if result['is_sample']:
                    results.append({
                        'test_case_id': result['test_id'],
                        'input': result['original_input'],
                        'expected_output': result['original_output'],
                        'actual_output': result['output'],
                        'passed': result['passed'],
                        'status': result['status'],
                        'error': result['error'],
                        'points': result['test_points'] if result['passed'] else 0,
                        'is_sample': True
                    })
                else:
                    results.append({
                        'test_case_id': result['test_id'],
                        'input': None,
                        'expected_output': None,
                        'actual_output': None,
                        'passed': result['passed'],
                        'status': result['status'],
                        'error': 'Hidden test case failed' if not result['passed'] and result['status'] != 'Runtime Error' else result['error'],
                        'points': result['test_points'] if result['passed'] else 0,
                        'is_sample': False
                    })
                
                if result['passed']:
                    actual_points_earned += result['test_points']
                else:
                    all_passed = False
                    if not first_failure_status:
                        first_failure_status = result['status']
            
            except Exception as e:
                print(f"Error executing test: {e}")
                all_passed = False
                if not first_failure_status:
                    first_failure_status = 'System Error'
        
        results.sort(key=lambda x: x['test_case_id'])
        
        if all_passed:
            try:
                uid = request.user['uid']
                user_ref = db.collection('users').document(uid)
                user_doc = user_ref.get()
                
                if user_doc.exists:
                    user_data = user_doc.to_dict()
                    solved_problems = user_data.get('solved_problems', [])
                    
                    if problem_id not in solved_problems:
                        solved_problems.append(problem_id)
                        user_ref.update({
                            'solved_problems': solved_problems,
                            'problems_solved': len(solved_problems),
                            'points': user_data.get('points', 0) + problem_points,
                            'last_active': datetime.now()
                        })
            except Exception as e:
                print(f"Warning: Failed to update user stats: {e}")
        
        overall_status = 'Accepted' if all_passed else (first_failure_status or 'Wrong Answer')
        
        return jsonify({
            'success': True,
            'all_passed': all_passed,
            'results': results,
            'total_points': problem_points if all_passed else 0,
            'points_earned': actual_points_earned,  
            'verdict': overall_status,
            'message': 'Accepted' if all_passed else f'{overall_status}'
        }), 200
    
    except Exception as e:
        print(f"Error in submit_solution: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': f'Submission failed: {str(e)}'}), 500
    
    finally:
        if conn:
            conn.close()

    
@app.route('/api/problem/<slug>/run', methods=['POST'])
@token_required
def run_code(slug):
    conn = None
    try:
        data = request.json
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        code = data.get('code', '').strip()
        language_id = data.get('language_id', 71)
        
        if not code:
            return jsonify({'error': 'No code provided'}), 400
        
        if language_id not in [71, 63, 62, 54]:
            return jsonify({'error': f'Unsupported language: {language_id}'}), 400
        
        conn = get_db_connection()
        cur = conn.cursor()
        
        cur.execute("""
            SELECT id, boilerplate_python, boilerplate_java, 
                   boilerplate_cpp, boilerplate_javascript, order_matters
            FROM problems 
            WHERE slug = ?
        """, (slug,))
        problem_row = cur.fetchone()
        
        if not problem_row:
            return jsonify({'error': 'Problem not found'}), 404
        
        problem_id = problem_row['id']
        order_matters = bool(problem_row['order_matters']) if problem_row['order_matters'] is not None else True
        
        boilerplate_map = {
            71: problem_row['boilerplate_python'],
            63: problem_row['boilerplate_javascript'],
            62: problem_row['boilerplate_java'],
            54: problem_row['boilerplate_cpp']
        }
        boilerplate_code = boilerplate_map.get(language_id, problem_row['boilerplate_python'])
        
        cur.execute("""
            SELECT id, input, expected_output, input_json, expected_output_json, 
                   explanation, is_sample, display_order
            FROM test_cases
            WHERE problem_id = ? AND is_sample = 1
            ORDER BY display_order
        """, (problem_id,))
        sample_test_cases = cur.fetchall()
        
        if not sample_test_cases:
            return jsonify({'error': 'No sample test cases found'}), 404
        
        prepared_tests = []
        for tc in sample_test_cases:
            try:
                if tc['input_json']:
                    test_input = safe_json_load(tc['input_json'])
                else:
                    test_input = safe_json_load(tc['input']) if tc['input'] else {}
                
                if not isinstance(test_input, dict):
                    test_input = {'input': test_input}
                
                if tc['expected_output_json']:
                    test_output = safe_json_load(tc['expected_output_json'])
                else:
                    test_output = safe_json_load(tc['expected_output'])
                
                prepared_tests.append({
                    'id': tc['id'],
                    'input': test_input,
                    'output': test_output,
                    'explanation': tc['explanation'],
                    'original_input': tc['input'],
                    'original_output': tc['expected_output']
                })
            
            except Exception as e:
                print(f"Warning: Failed to parse test case {tc['id']}: {e}")
                continue
        
        if not prepared_tests:
            return jsonify({'error': 'No valid test cases found'}), 500
        
        def execute_test(test):
            result = execute_code_piston(
                user_code=code,
                test_case_input_json=test['input'],
                test_case_output_json=test['output'],
                language_id=language_id,
                boilerplate_code=boilerplate_code,
                problem_slug=slug,
                order_matters=order_matters
            )
            result['test_id'] = test['id']
            result['explanation'] = test['explanation']
            result['original_input'] = test['original_input']
            result['original_output'] = test['original_output']
            return result
        
        futures = {executor.submit(execute_test, test): test for test in prepared_tests}
        
        results = []
        all_passed = True
        
        for future in as_completed(futures):
            try:
                result = future.result(timeout=30)
                
                results.append({
                    'test_case_id': result['test_id'],
                    'input': result['original_input'],
                    'expected_output': result['original_output'],
                    'actual_output': result['output'],
                    'passed': result['passed'],
                    'status': result['status'],
                    'error': result['error'],
                    'explanation': result['explanation']
                })
                
                if not result['passed']:
                    all_passed = False
            
            except Exception as e:
                print(f"Error executing test: {e}")
                all_passed = False
        
        results.sort(key=lambda x: x['test_case_id'])
        
        return jsonify({
            'success': True,
            'all_passed': all_passed,
            'results': results,
            'message': 'All sample test cases passed!' if all_passed else 'Some sample test cases failed'
        }), 200
        
    except Exception as e:
        print(f"Error in run_code: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': f'Execution failed: {str(e)}'}), 500
    
    finally:
        if conn:
            conn.close()

##settings

@app.route('/api/user/<uid>/update-name', methods=['PUT'])
@token_required
def update_display_name(uid):
    try:
        if request.user['uid'] != uid:
            return jsonify({'error': 'Unauthorized'}), 403
        
        data = request.json
        new_name = data.get('name', '').strip()
        
        if not new_name:
            return jsonify({'error': 'Name cannot be empty'}), 400
        
        if len(new_name) > 50:
            return jsonify({'error': 'Name must be 50 characters or less'}), 400
        
        user_ref = db.collection('users').document(uid)
        user_doc = user_ref.get()
        
        if not user_doc.exists:
            return jsonify({'error': 'User not found'}), 404
        
        user_ref.update({
            'name': new_name,
            'last_active': datetime.now()
        })
        
        return jsonify({
            'success': True,
            'name': new_name,
            'message': 'Display name updated successfully'
        }), 200
        
    except Exception as e:
        print(f"Error updating display name: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/user/<uid>/upload-picture', methods=['POST'])
@token_required
def upload_profile_picture(uid):
    try:
        if request.user['uid'] != uid:
            return jsonify({'error': 'Unauthorized'}), 403
        
        if 'picture' not in request.files:
            return jsonify({'error': 'No file uploaded'}), 400
        
        file = request.files['picture']
        
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        if not allowed_file(file.filename):
            return jsonify({'error': 'Invalid file type. Only PNG and JPG are allowed'}), 400
        
        image = Image.open(file.stream)
        
        if image.mode in ('RGBA', 'LA', 'P'):
            background = Image.new('RGB', image.size, (255, 255, 255))
            if image.mode == 'P':
                image = image.convert('RGBA')
            background.paste(image, mask=image.split()[-1] if image.mode == 'RGBA' else None)
            image = background
        
        image.thumbnail((MAX_IMAGE_DIMENSION, MAX_IMAGE_DIMENSION), Image.Resampling.LANCZOS)
        
        file_ext = 'jpg'  
        unique_filename = f"{uid}_{uuid.uuid4().hex[:8]}.{file_ext}"
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], unique_filename)
        image.save(filepath, 'JPEG', quality=85, optimize=True)
        
        picture_url = url_for('static', filename=f'uploads/{unique_filename}', _external=True)
        
        user_ref = db.collection('users').document(uid)
        user_doc = user_ref.get()
        
        if not user_doc.exists:
            return jsonify({'error': 'User not found'}), 404
        
        user_data = user_doc.to_dict()
        old_picture = user_data.get('picture', '')
        if old_picture and '/static/uploads/' in old_picture:
            try:
                old_filename = old_picture.split('/static/uploads/')[-1]
                old_filepath = os.path.join(app.config['UPLOAD_FOLDER'], old_filename)
                if os.path.exists(old_filepath):
                    os.remove(old_filepath)
            except Exception as e:
                print(f"Error deleting old picture: {e}")
        
        user_ref.update({
            'picture': picture_url,
            'last_active': datetime.now()
        })
        
        return jsonify({
            'success': True,
            'picture_url': picture_url,
            'message': 'Profile picture updated successfully'
        }), 200
        
    except Exception as e:
        print(f"Error uploading profile picture: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/problems', methods=['GET'])
@token_required
def get_problems():
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        cur.execute("""
            SELECT 
                id, title, slug, difficulty, 
                topic_tags, company_tags, points,
                acceptance_rate, created_at
            FROM problems
            ORDER BY id ASC         
        """)

        problems = []
        for row in cur.fetchall():
            t_tags = row['topic_tags'].split(',') if row['topic_tags'] else []
            c_tags = row['company_tags'].split(',') if row['company_tags'] else []

            problems.append({
                'id': row['id'],
                'title': row['title'], 
                'slug': row['slug'],   
                'difficulty': row['difficulty'],
                'topic_tags': [t.strip() for t in t_tags],
                'company_tags': [t.strip() for t in c_tags],
                'points': row['points'],
                'acceptance_rate': row['acceptance_rate'],
                'created_at': row['created_at']
            })
        conn.close()
        return jsonify(problems), 200
    
    except Exception as e:
        print(f"Error fetching problems: {e}")
        return jsonify({'error': str(e)}), 500

##problems

@app.route('/api/problem/<slug>', methods=['GET'])
@token_required
def get_problem_detail(slug):
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("""
            SELECT 
                id, title, slug, description, input_format, output_format,
                difficulty, topic_tags, company_tags, constraints,
                boilerplate_python, boilerplate_java, boilerplate_cpp, boilerplate_javascript,
                time_complexity, space_complexity, points, acceptance_rate, created_at
            FROM problems
            WHERE slug = ?
        """, (slug,))

        problem_row = cur.fetchone()
        if not problem_row:
            conn.close()
            return jsonify({'error': 'Problem not found'}), 404
        
        t_tags = problem_row['topic_tags'].split(',') if problem_row['topic_tags'] else []
        c_tags = problem_row['company_tags'].split(',') if problem_row['company_tags'] else []

        problem = {
            'id': problem_row['id'],
            'title': problem_row['title'],
            'slug': problem_row['slug'],
            'description': problem_row['description'],
            'input_format': problem_row['input_format'],
            'output_format': problem_row['output_format'],
            'difficulty': problem_row['difficulty'],
            'topic_tags': [t.strip() for t in t_tags],    
            'company_tags': [t.strip() for t in c_tags],
            'constraints': problem_row['constraints'],
            'boilerplate_code': {
                'python': problem_row['boilerplate_python'],
                'java': problem_row['boilerplate_java'],
                'cpp': problem_row['boilerplate_cpp'],
                'javascript': problem_row['boilerplate_javascript']
            },
            'time_complexity': problem_row['time_complexity'],
            'space_complexity': problem_row['space_complexity'],
            'points': problem_row['points'],
            'acceptance_rate': problem_row['acceptance_rate'],
            'created_at': problem_row['created_at']
        }

        cur.execute("""
            SELECT id, input, expected_output, is_sample, explanation, points, display_order
            FROM test_cases
            WHERE problem_id = ? AND is_sample = 1
            ORDER BY display_order
        """, (problem['id'],))
        
        sample_test_cases = []
        for tc in cur.fetchall():
            sample_test_cases.append({
                'id': tc['id'],
                'input': tc['input'],
                'expected_output': tc['expected_output'],
                'is_sample': bool(tc['is_sample']),
                'explanation': tc['explanation'],
                'points': tc['points']
            })

        problem['sample_test_cases'] = sample_test_cases

        cur.execute("""
            SELECT id, hint, display_order
            FROM hints
            WHERE problem_id = ?
            ORDER BY display_order
        """, (problem['id'],))

        hints = []
        for hint in cur.fetchall():
            hints.append({
                'id': hint['id'],
                'hint': hint['hint']
            })

        problem['hints'] = hints

        conn.close()
        return jsonify(problem), 200
    
    except Exception as e:
        print(f"Error fetching problem detail: {e}")
        return jsonify({'error': str(e)}), 500

##leaderboards

@app.route('/api/leaderboard', methods=['GET'])
@token_required
def get_leaderboard():
    try:
        users_ref = db.collection('users')
        users = users_ref.order_by('points', direction=firestore.Query.DESCENDING).limit(100).stream()

        leaderboard = []
        for user in users:
            user_data = user.to_dict()
            leaderboard.append({
                'uid': user_data.get('uid'),
                'name': user_data.get('name'),
                'email': user_data.get('email'),
                'picture': user_data.get('picture'),
                'points': user_data.get('points', 0),
                'problems_solved': user_data.get('problems_solved', 0)
            })
        return jsonify(leaderboard), 200
    
    except Exception as e:
        print(f"Error fetching leaderboard: {e}")
        return jsonify({'error': str(e)}), 500
    
##profile

@app.route('/api/profile/<uid>', methods=['GET'])
def get_public_profile(uid):
    try:
        user_ref = db.collection('users').document(uid)
        user_doc = user_ref.get()
        
        if not user_doc.exists:
            return jsonify({'error': 'User not found'}), 404
        
        user_data = user_doc.to_dict()
        
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("SELECT id, difficulty FROM problems")
        all_problems = cur.fetchall()
        conn.close()
        
        solved_ids = user_data.get('solved_problems', [])
        difficulty_stats = {'Easy': 0, 'Medium': 0, 'Hard': 0}
        total_by_difficulty = {'Easy': 0, 'Medium': 0, 'Hard': 0}
        
        for problem in all_problems:
            diff = problem['difficulty']
            total_by_difficulty[diff] += 1
            if problem['id'] in solved_ids:
                difficulty_stats[diff] += 1
        
        profile_data = {
            'uid': user_data['uid'],
            'name': user_data['name'],
            'email': user_data['email'],
            'picture': user_data.get('picture'),
            'points': user_data.get('points', 0),
            'problems_solved': user_data.get('problems_solved', 0),
            'solved_problems': user_data.get('solved_problems', []),
            'difficulty_stats': difficulty_stats,
            'total_by_difficulty': total_by_difficulty,
            'created_at': user_data['created_at'].isoformat() if 'created_at' in user_data else None,
            'last_active': user_data['last_active'].isoformat() if 'last_active' in user_data else None
        }
        
        users_ref = db.collection('users').order_by('points', direction=firestore.Query.DESCENDING).stream()
        rank = 1
        for user in users_ref:
            if user.id == uid:
                profile_data['rank'] = rank
                break
            rank += 1
        
        return jsonify(profile_data), 200
        
    except Exception as e:
        print(f"Error fetching public profile: {e}")
        return jsonify({'error': str(e)}), 500


# Error Handlers

@app.errorhandler(404)
def not_found(e):
    return render_template('index.html'), 404

@app.errorhandler(500)
def server_error(e):
    return jsonify({'error': 'Internal server error'}), 500




if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)