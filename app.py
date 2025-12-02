# app.py
from flask import Flask, render_template
import os

app = Flask(__name__)
app.secret_key = os.environ.get('SECRET_KEY', 'dev-secret-key-change-in-production')

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/auth')
def auth():
    return "auth page"

@app.errorhandler(404)
def not_found(e):
    return render_template('index.html'), 404

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)