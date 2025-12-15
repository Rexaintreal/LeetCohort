<div align="center">
  <img src="static/assets/logo.png" alt="LeetCohort Logo" width="200"/>
  
  # LeetCohort
  
  **Free Python coding practice platform built for Axiom YSWS**
  
  [![GitHub](https://img.shields.io/badge/GitHub-LeetCohort-blue?logo=github)](https://github.com/Rexaintreal/LeetCohort)
  [![Axiom](https://img.shields.io/badge/Built%20for-Axiom%20YSWS-orange)](https://axiom.hackclub.com/)
  [![Hackatime](https://hackatime-badge.hackclub.com/U09B8FXUS78/LeetCohort)](https://hackatime-badge.hackclub.com/U09B8FXUS78/LeetCohort)
  [![Flask](https://img.shields.io/badge/Flask-000000?logo=flask&logoColor=white)](https://flask.palletsprojects.com/)
  [![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
  [![TailwindCSS](https://img.shields.io/badge/TailwindCSS-38B2AC?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
</div>

---

## About

LeetCohort is a free coding practice platform focused on Python Solve problems, earn points, and compete on the leaderboard. Built as part of the Axiom YSWS program.

---

## Live Demo

Try it out at [leetcohort.pythonanywhere.com](https://leetcohort.pythonanywhere.com/)
> **Note:** Hack Club OAuth is currently unavailable on the hosted version due to PythonAnywhere domain restrictions. A whitelist request has been submitted. For now, please use Google or GitHub to sign in.


---

## Features

- Solve Python coding problems across multiple difficulty levels
- Run code against sample test cases before submission 
- Submit solutions and get instant feedback
- Earn points for solving problems 
- Compete on the global leaderboard with other users
- Track your progress and solved problems with detailed charts
- OAuth login with Google, GitHub, and Hack Club
- Profile customization with picture upload
- Export your data or delete your account anytime

---

## Tech Stack

**Frontend**
- HTML
- Tailwind CSS via CDN
- Vanilla JavaScript

**Backend**
- Flask
- SQLite for problem storage
- Firebase Firestore for user data
- Firebase Authentication
- HackClub and GitHub OAuth ()

**Hosting**
- PythonAnywhere for free hosting

**Code Execution**
- Piston API for secure code execution

---

## How It Works

**Problem Solving Flow**

1. **Browse Problems** - View coding challenges filtered by difficulty and topics
2. **Write Solution** - Use the code editor to write your Python solution
3. **Test Code** - Run against sample test cases to verify basic functionality
4. **Submit** - Your code runs against all test cases including hidden ones
5. **Get Feedback** - Instant results showing which test cases passed or failed
6. **Earn Points** - Successfully passing all test cases awards points based on difficulty

**Behind the Scenes**

- Your code gets wrapped with a test harness and sent to Piston API for execution
- Multiple test cases run in parallel for faster results
- Output is compared with expected results using smart comparison logic
- Some problems check time complexity to ensure efficient solutions
- All execution happens in isolated sandboxed containers for security
- Points and solved problems sync to your profile automatically

**Scoring System**

- Easy problems: 10-20 points
- Medium problems: 30-40 points  
- Hard problems: 50+ points
- Each test case within a problem can award partial points
- Leaderboard ranks users by total points earned


---

## Project Structure
```
LeetCohort/
├── app.py                  # Main Flask application
├── execution.py            # Code execution logic
├── requirements.txt        # Python dependencies
├── db/
│   ├── createDb.py        # Database schema creation
│   ├── insertDb.py        # Problem insertion script
│   ├── problems.json      # Problem data
│   └── problems.db        # SQLite database
├── static/
│   ├── assets/            # Images and logos
│   ├── css/               # Stylesheets
│   ├── js/                # JavaScript files
│   └── uploads/           # User uploaded profile pictures
└── templates/             # HTML templates
```

---

## Setup and Installation

### Prerequisites
- Python 3.12 or higher
- pip for installing packages
- Firebase project with Firestore and Authentication enabled

### Installation Steps

1. Clone the repository
```bash
   git clone https://github.com/Rexaintreal/LeetCohort.git
   cd LeetCohort
```

2. Create a virtual environment
   
   Windows:
```bash
   python -m venv venv
   .\venv\Scripts\activate
```
   
   macOS / Linux:
```bash
   python3 -m venv venv
   source venv/bin/activate
```

3. Install dependencies
```bash
   pip install -r requirements.txt
```

4. Set up environment variables
   
   Create a `.env` file in the root directory with:
```
   FLASK_SECRET_KEY=your_secret_key
   
   FIREBASE_API_KEY=your_firebase_api_key
   FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
   FIREBASE_PROJECT_ID=your_project_id
   FIREBASE_STORAGE_BUCKET=your_project.appspot.com
   FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   FIREBASE_APP_ID=your_app_id
   FIREBASE_MEASUREMENT_ID=your_measurement_id
   
   HACKCLUB_CLIENT_ID=your_hackclub_client_id
   HACKCLUB_CLIENT_SECRET=your_hackclub_secret
   HACKCLUB_REDIRECT_URI=http://localhost:5000/auth/hackclub/callback
   
   GITHUB_CLIENT_ID=your_github_client_id
   GITHUB_CLIENT_SECRET=your_github_secret
   GITHUB_REDIRECT_URI=http://localhost:5000/auth/github/callback
   
   MAIL_USERNAME=your_email@gmail.com
   MAIL_PASSWORD=your_app_password
   MAIL_DEFAULT_SENDER=your_email@gmail.com
```

5. Add Firebase Admin SDK
   
   Download your Firebase Admin SDK JSON file and save it as `firebase-admin-sdk.json` in the root directory

6. Initialize the database
```bash
   cd db
   python createDb.py
   python insertDb.py
   cd ..
```

7. Run the application
```bash
   python app.py
```

8. Open your browser and go to `http://127.0.0.1:5000`

---

## Database Schema

### Problems Table
```sql
CREATE TABLE problems (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT NOT NULL,
    input_format TEXT,
    output_format TEXT,
    difficulty TEXT CHECK(difficulty IN ('Easy', 'Medium', 'Hard')),
    topic_tags TEXT,
    company_tags TEXT,
    constraints TEXT,
    boilerplate_code TEXT,
    time_complexity TEXT,
    space_complexity TEXT,
    points INTEGER DEFAULT 10,
    order_matters INTEGER DEFAULT 1,
    check_complexity INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Test Cases Table
```sql
CREATE TABLE test_cases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    problem_id INTEGER NOT NULL,
    input TEXT,
    expected_output TEXT,
    input_json TEXT,
    expected_output_json TEXT,
    is_sample INTEGER DEFAULT 0,
    explanation TEXT,
    points INTEGER DEFAULT 10,
    display_order INTEGER DEFAULT 0,
    FOREIGN KEY (problem_id) REFERENCES problems(id) ON DELETE CASCADE
);
```

### Hints Table
```sql
CREATE TABLE hints (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    problem_id INTEGER NOT NULL,
    hint TEXT NOT NULL,
    display_order INTEGER DEFAULT 0,
    FOREIGN KEY (problem_id) REFERENCES problems(id) ON DELETE CASCADE
);
```

---

## Features in Detail

**Code Execution**
- Sample test cases visible before submission
- Hidden test cases for actual submission
- Time complexity validation for certain problems
- Parallel test case execution for faster results

**Scoring System**
- Each test case awards points when passed
- Problems have difficulty based total points
- Leaderboard ranks users by total points earned
- Track solved problems by difficulty level

**User Accounts**
- OAuth login via Google, GitHub, or Hack Club
- Customizable profile with name and picture
- View solved problems and statistics
- Export all your data as JSON
- Delete account and all associated data

---

## Credits

**Landing Page Background** - [uiverse.io/1k24bytes/hot-cow-99](https://uiverse.io/1k24bytes/hot-cow-99)

**Problems** - [GeeksforGeeks DSA Interview Questions](https://www.geeksforgeeks.org/dsa/top-100-data-structure-and-algorithms-dsa-interview-questions-topic-wise/)

**Avatars** - Pinterest and Orpheus from [Hack Club Summer of Making](https://summer.hackclub.com/)

---

## Other Projects

- [Sorta](https://github.com/Rexaintreal/Sorta) - A Sorting Algorithm Visualizer
- [Ziks](https://github.com/Rexaintreal/Ziks) - A physics simulator with 21 Simulatons made using vanilla JS
- [Eureka](https://github.com/Rexaintreal/Eureka) - A website to find local spots near you which don't show up on Google Maps
- [DawnDuck](https://github.com/Rexaintreal/DawnDuck) - USB HID Automation Tool for Morning Routines
- [Lynx](https://github.com/Rexaintreal/lynx) - OpenCV Image Manipulation WebApp
- [Libro Voice](https://github.com/Rexaintreal/Libro-Voice) - PDF to Audio Converter
- [Snippet Vision](https://github.com/Rexaintreal/Snippet-Vision) - YouTube Video Summarizer
- [Weather App](https://github.com/Rexaintreal/WeatherApp) - Python Weather Forecast App
- [Python Screenrecorder](https://github.com/Rexaintreal/PythonScreenrecorder) - Python Screen Recorder
- [Typing Speed Tester](https://github.com/Rexaintreal/TypingSpeedTester) - Python Typing Speed Tester
- [Movie Recommender](https://github.com/Rexaintreal/Movie-Recommender) - Python Movie Recommender
- [Password Generator](https://github.com/Rexaintreal/Password-Generator) - Python Password Generator
- [Object Tales](https://github.com/Rexaintreal/Object-Tales) - Python Image to Story Generator
- [Finance Manager](https://github.com/Rexaintreal/Finance-Manager) - Flask WebApp to Monitor Savings
- [Codegram](https://github.com/Rexaintreal/Codegram) - Social Media for Coders
- [Simple Flask Notes](https://github.com/Rexaintreal/Simple-Flask-Notes) - Flask Notes App
- [Key5](https://github.com/Rexaintreal/key5) - Python Keylogger
- [Codegram2024](https://github.com/Rexaintreal/Codegram2024) - Modern Codegram Update
- [Cupid](https://github.com/Rexaintreal/cupid) - Dating Web App for Teenagers
- [Gym Vogue](https://github.com/Rexaintreal/GymVogue/) - Ecommerce for Gym Freaks
- [Confessions](https://github.com/Rexaintreal/Confessions) - Anonymous Confession Platform
- [Syna](https://github.com/Rexaintreal/syna) - Social Music App with Spotify
- [Apollo](https://github.com/Rexaintreal/Apollo) - Minimal Music Player with Dancing Cat
- [Eros](https://github.com/Rexaintreal/Eros) - Face Symmetry Analyzer
- [Notez](https://github.com/Rexaintreal/Notez) - Clean Android Notes App

---

## License

MIT License - see [LICENSE](LICENSE) file for details

---

## Author

Built by Saurabh Tiwari

- Portfolio: [saurabhcodesawfully.pythonanywhere.com](https://saurabhcodesawfully.pythonanywhere.com/)
- Email: [saurabhtiwari7986@gmail.com](mailto:saurabhtiwari7986@gmail.com)
- Twitter: [@Saurabhcodes01](https://x.com/Saurabhcodes01)
- Instagram: [@saurabhcodesawfully](https://instagram.com/saurabhcodesawfully)
