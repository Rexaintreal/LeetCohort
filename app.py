from flask import Flask, render_template, redirect, url_for, session, request, jsonify
import firebase_admin
from firebase_admin import credentials
from firebase_admin import auth as firebase_auth
import os
from functools import wraps

app = Flask(__name__)
app.secret_key = os.environ.get('SECRET_KEY', 'dev-secret-key-change-in-production')
cred = credentials.Certificate('firebase-admin-sdk.json')
firebase_admin.initialize_app(cred)

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user' not in session:
            return redirect(url_for('auth'))
        return f(*args, **kwargs)
    return decorated_function

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

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/auth')
def auth():
    if 'user' in session:
        return redirect(url_for('home'))
    return render_template('auth.html')

@app.route('/auth/verify', methods=['POST'])
def verify_token():
    try:
        id_token = request.json.get('idToken')
        decoded_token = firebase_auth.verify_id_token(id_token)
        uid = decoded_token['uid']
        user = firebase_auth.get_user(uid)
        session['user'] = {
            'uid': uid,
            'email': user.email,
            'name': user.display_name,
            'picture': user.photo_url
        }
        return jsonify({'success': True}), 200
    except Exception as e:
        print(f"Error verifying token: {e}")
        return jsonify({'success': False, 'error': str(e)}), 401
    
@app.route('/home')
@login_required
def home():
    user = session.get('user')
    return render_template('home.html', user=user)

@app.route('/logout')
def logout():
    session.pop('user', None)
    return redirect(url_for('index'))

@app.errorhandler(404)
def not_found(e):
    return render_template('index.html'), 404

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)