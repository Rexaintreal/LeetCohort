from flask import Flask, Response, render_template, request, jsonify
from flask_cors import CORS
import firebase_admin
from firebase_admin import credentials, firestore
from firebase_admin import auth as firebase_auth
from datetime import datetime
import os
from functools import wraps
import sqlite3
import requests

app = Flask(__name__)
CORS(app)
cred = credentials.Certificate('firebase-admin-sdk.json')
firebase_admin.initialize_app(cred)
db = firestore.client()

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
    conn= sqlite3.connect('db/problems.db')
    conn.row_factory = sqlite3.Row
    return conn



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

# API 
@app.route('/api/problems', methods=['GET'])
@token_required
def get_problems():
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        cur.execute("""
            SELECT id, title, slug, description, difficulty, created_at
            FROM problems
            ORDER BY id ASC         
        """)

        problems = []
        for row in cur.fetchall():
            problems.append({
                'id': row['id'],
                'title': row['title'], 
                'slug': row['slug'],   
                'description': row['description'],
                'difficulty': row['difficulty'],
                'created_at': row['created_at']
            })
        conn.close()
        return jsonify(problems), 200
    
    except Exception as e:
        print(f"Error fetching problems: {e}")
        return jsonify({'error': str(e)}), 500

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
                'name':user_data.get('name'),
                'email': user_data.get('email'),
                'picture': user_data.get('picture'),
                'points': user_data.get('points', 0),
                'problems_solved': user_data.get('problems_solved', 0)
            })
        return jsonify(leaderboard), 200
    
    except Exception as e:
        print(f"Error fetching leaderboard: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/problem/<slug>', methods=['GET'])
@token_required
def get_problem_detail(slug):
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("""
            SELECT id, title, slug, description, difficulty, boilerplate_code, created_at
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
            'difficulty': problem_row['difficulty'],
            'boilerplate_code': problem_row['boilerplate_code'],
            'created_at': problem_row['created_at']
        }

        cur.execute("""
                    SELECT id, input, expected_output, points
                    FROM test_cases
                    WHERE problem_id = ?
                    """, (problem['id'],))
        test_cases = []
        for tc in cur.fetchall():
            test_cases.append({
                'id': tc['id'],
                'input': tc['input'],
                'expected_output': tc['expected_output'],
                'points': tc['points']
            })

        problem['test_cases'] = test_cases

        cur.execute("""
            SELECT id, hint
            FROM hints
            WHERE problem_id = ?
        """, (problem['id'],))

        hints = []
        for hint in cur.fetchall():
            hints.append({
                'id': hint['id'],
                'hint': hint['hint']
            })

        problem['hint'] = hints

        conn.close()
        return jsonify(problem), 200
    
    except Exception as e:
        print(f"Error fetching problem detail: {e}")
        return jsonify({'error': str(e)}), 500
    



    
@app.route('/api/profile/<uid>', methods=['GET'])
def get_public_profile(uid):
    """Get public profile data for any user (no auth required)"""
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



#routes

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

#AUTH and Session mngmnt

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



@app.errorhandler(404)
def not_found(e):
    return render_template('index.html'), 404

@app.errorhandler(500)
def server_error(e):
    return jsonify({'error': 'Internal server error'}), 500




if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)