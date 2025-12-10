from flask import Flask, render_template, request, jsonify
from flask_cors import CORS
import firebase_admin
from firebase_admin import credentials, firestore
from firebase_admin import auth as firebase_auth
from datetime import datetime
import os
from functools import wraps

app = Flask(__name__)
CORS(app)
cred = credentials.Certificate('firebase-admin-sdk.json')
firebase_admin.initialize_app(cred)
db = firestore.client()

def token_required(f):
    """Decorator to verify Firebase ID token"""
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

@app.route('/api/firebase-config')
def firebase_config():
    """Serve public Firebase configuration from environment variables"""
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