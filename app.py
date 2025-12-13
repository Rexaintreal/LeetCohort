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
import io
import base64
import time
import json

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


# EXECUTING CODE USING JUDGE0 API
def execute_code_judge0(code, input_data, expected_output, language_id, is_run=False):

    JUDGE0_URL = "https://judge0-ce.p.rapidapi.com"
    RAPIDAPI_KEY = os.getenv('RAPIDAPI_KEY', '')  
    
    if not RAPIDAPI_KEY:
        JUDGE0_URL = "https://judge0-ce.p.rapidapi.com"  
    
    headers = {
        "content-type": "application/json",
        "X-RapidAPI-Key": RAPIDAPI_KEY,
        "X-RapidAPI-Host": "judge0-ce.p.rapidapi.com"
    } if RAPIDAPI_KEY else {
        "content-type": "application/json"
    }
    encoded_code = base64.b64encode(code.encode()).decode()
    encoded_input = base64.b64encode(input_data.encode()).decode() if input_data else ""
    
    submission_data = {
        "source_code": encoded_code,
        "language_id": language_id,
        "stdin": encoded_input,
        "expected_output": base64.b64encode(expected_output.encode()).decode() if expected_output else None
    }
    
    try:
        submit_url = "https://ce.judge0.com/submissions?base64_encoded=true&wait=true"
        
        response = requests.post(submit_url, json=submission_data, timeout=10)
        
        if response.status_code != 201 and response.status_code != 200:
            return {
                'output': '',
                'passed': False,
                'status': 'Error',
                'error': f'Judge0 API error: {response.status_code}'
            }
        
        result = response.json()
        
        stdout = base64.b64decode(result.get('stdout', '')).decode() if result.get('stdout') else ''
        stderr = base64.b64decode(result.get('stderr', '')).decode() if result.get('stderr') else ''
        compile_output = base64.b64decode(result.get('compile_output', '')).decode() if result.get('compile_output') else ''
        
        output = stdout or stderr or compile_output or ''
        status_id = result.get('status', {}).get('id')
        status_desc = result.get('status', {}).get('description', 'Unknown')
        
        passed = False
        if is_run:
            passed = status_id == 3
        elif expected_output:
            passed = status_id == 3 and output.strip() == expected_output.strip()
        
        return {
            'output': output,
            'passed': passed,
            'status': status_desc,
            'error': stderr or compile_output if status_id != 3 else ''
        }
        
    except requests.exceptions.Timeout:
        return {
            'output': '',
            'passed': False,
            'status': 'Timeout',
            'error': 'Code execution timed out'
        }
    except Exception as e:
        return {
            'output': '',
            'passed': False,
            'status': 'Error',
            'error': str(e)
        }
    
# image proxy route

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
    try:
        data = request.json
        code = data.get('code', '')
        language_id = data.get('language_id', 71) 

        if not code:
            return jsonify({'error': 'No code provided'}), 400
        
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("""
            SELECT id, title, points FROM problems WHERE slug = ?
        """, (slug,))
        problem_row = cur.fetchone()

        if not problem_row:
            conn.close()
            return jsonify({'error': 'Problem not found'}), 404
        
        problem_id = problem_row['id']
        problem_points = problem_row['points']

        cur.execute("""
            SELECT id, input, expected_output, points, is_sample
            FROM test_cases
            WHERE problem_id = ?
            ORDER BY display_order
        """, (problem_id,))
        test_cases = cur.fetchall()
        conn.close()

        if not test_cases:
            return jsonify({'error': 'No test cases found'}), 404
        
        results = []
        all_passed = True
        total_points = 0

        for tc in test_cases:
            result = execute_code_judge0(code, tc['input'], tc['expected_output'], language_id)
            results.append({
                'test_case_id': tc['id'],
                'input': tc['input'],
                'expected_output': tc['expected_output'],
                'actual_output': result['output'],
                'passed': result['passed'],
                'status': result['status'],
                'error': result.get('error', ''),
                'points': tc['points'] if result['passed'] else 0,
                'is_sample': bool(tc['is_sample'])
            })

            if result['passed']:
                total_points += tc['points']
            else:
                all_passed = False

        if all_passed:
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
        return jsonify({
            'success': True,
            'all_passed': all_passed,
            'results': results,
            'total_points': problem_points if all_passed else 0,
            'message': 'All test cases passed!' if all_passed else 'Some test cases failed'
        }), 200
    
    except Exception as e:
        print(f"Error submitting solution: {e}")
        return jsonify({'error': str(e)}), 500
    
@app.route('/api/problem/<slug>/run', methods=['POST'])
@token_required
def run_code(slug):
    try:
        data = request.json
        code = data.get('code', '')
        language_id = data.get('language_id', 71)

        if not code:
            return jsonify({'error': 'No code provided'}), 400
        
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("""
            SELECT id FROM problems WHERE slug = ?
        """, (slug,))
        problem_row = cur.fetchone()

        if not problem_row:
            conn.close()
            return jsonify({'error': 'Problem not found'}), 404
        
        problem_id = problem_row['id']

        cur.execute("""
            SELECT id, input, expected_output, explanation, is_sample
            FROM test_cases
            WHERE problem_id = ? AND is_sample = 1
            ORDER BY display_order
        """, (problem_id,))
        sample_test_cases = cur.fetchall()
        conn.close()

        if not sample_test_cases:
            return jsonify({'error': 'No sample test cases found'}), 404
        
        results = []
        all_passed = True

        for tc in sample_test_cases:
            result = execute_code_judge0(code, tc['input'], tc['expected_output'], language_id)
            results.append({
                'test_case_id': tc['id'],
                'input': tc['input'],
                'expected_output': tc['expected_output'],
                'actual_output': result['output'],
                'passed': result['passed'],
                'status': result['status'],
                'error': result.get('error', ''),
                'explanation': tc['explanation']
            })

            if not result['passed']:
                all_passed = False

        return jsonify({
            'success': True,
            'all_passed': all_passed,
            'results': results,
            'message': 'All sample test cases passed!' if all_passed else 'Some sample test cases failed'
        }), 200
        
    except Exception as e:
        print(f"Error running code: {e}")
        return jsonify({'error': str(e)}), 500

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
            problems.append({
                'id': row['id'],
                'title': row['title'], 
                'slug': row['slug'],   
                'difficulty': row['difficulty'],
                'topic_tags': json.loads(row['topic_tags']) if row['topic_tags'] else [],
                'company_tags': json.loads(row['company_tags']) if row['company_tags'] else [],
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
        
        problem = {
            'id': problem_row['id'],
            'title': problem_row['title'],
            'slug': problem_row['slug'],
            'description': problem_row['description'],
            'input_format': problem_row['input_format'],
            'output_format': problem_row['output_format'],
            'difficulty': problem_row['difficulty'],
            'topic_tags': json.loads(problem_row['topic_tags']) if problem_row['topic_tags'] else [],
            'company_tags': json.loads(problem_row['company_tags']) if problem_row['company_tags'] else [],
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