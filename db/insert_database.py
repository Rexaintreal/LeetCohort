import sqlite3
import json
import os

def create_database(db_path="db/problems.db"):
    os.makedirs(os.path.dirname(db_path), exist_ok=True)
    if os.path.exists(db_path):
        os.remove(db_path)
    
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    
    cur.execute("""
    CREATE TABLE IF NOT EXISTS problems (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        slug TEXT UNIQUE NOT NULL,
        description TEXT NOT NULL,
        input_format TEXT,
        output_format TEXT,
        difficulty TEXT CHECK(difficulty IN ('Easy','Medium','Hard')) NOT NULL,
        acceptance_rate REAL DEFAULT 0.0,
        topic_tags TEXT,
        company_tags TEXT,
        constraints TEXT,
        boilerplate_python TEXT,
        boilerplate_java TEXT,
        boilerplate_cpp TEXT,
        boilerplate_javascript TEXT,
        time_complexity TEXT,
        space_complexity TEXT,
        points INTEGER DEFAULT 10,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)
    
    cur.execute("""
    CREATE TABLE IF NOT EXISTS test_cases (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        problem_id INTEGER NOT NULL,
        input TEXT NOT NULL,
        expected_output TEXT NOT NULL,
        is_sample BOOLEAN DEFAULT 0,
        explanation TEXT,
        points INTEGER DEFAULT 10,
        display_order INTEGER DEFAULT 0,
        FOREIGN KEY (problem_id) REFERENCES problems(id) ON DELETE CASCADE
    )
    """)
    
    cur.execute("""
    CREATE TABLE IF NOT EXISTS hints (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        problem_id INTEGER NOT NULL,
        hint TEXT NOT NULL,
        display_order INTEGER DEFAULT 0,
        FOREIGN KEY (problem_id) REFERENCES problems(id) ON DELETE CASCADE
    )
    """)
    
    cur.execute("CREATE INDEX IF NOT EXISTS idx_problems_slug ON problems(slug)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_test_cases_problem ON test_cases(problem_id)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_hints_problem ON hints(problem_id)")
    
    conn.commit()
    return conn

def populate_database(conn, json_path="db/problems.json"):
    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    cur = conn.cursor()
    for problem in data['problems']:
        cur.execute("""
            INSERT INTO problems (
                title, slug, description, input_format, output_format,
                difficulty, topic_tags, company_tags, constraints,
                boilerplate_python, boilerplate_java, boilerplate_cpp, boilerplate_javascript,
                time_complexity, space_complexity, points
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            problem['title'],
            problem['slug'],
            problem['description'],
            problem.get('input_format', ''),
            problem.get('output_format', ''),
            problem['difficulty'],
            json.dumps(problem.get('topic_tags', [])),
            json.dumps(problem.get('company_tags', [])),
            problem.get('constraints', ''),
            problem.get('boilerplate_python', ''),
            problem.get('boilerplate_java', ''),
            problem.get('boilerplate_cpp', ''),
            problem.get('boilerplate_javascript', ''),
            problem.get('time_complexity', ''),
            problem.get('space_complexity', ''),
            problem.get('points', 10)
        ))
        problem_id = cur.lastrowid
        
        for idx, test_case in enumerate(problem.get('test_cases', [])):
            cur.execute("""
                INSERT INTO test_cases (
                    problem_id, input, expected_output, is_sample,
                    explanation, points, display_order
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (
                problem_id,
                test_case['input'],
                test_case['expected_output'],
                1 if test_case.get('is_sample', False) else 0,
                test_case.get('explanation', ''),
                10,
                idx
            ))
        
        for idx, hint in enumerate(problem.get('hints', [])):
            cur.execute("""
                INSERT INTO hints (
                    problem_id, hint, display_order
                ) VALUES (?, ?, ?)
            """, (problem_id, hint, idx))
    
    conn.commit()

def verify_database(conn):
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM problems")
    print("Total Problems:", cur.fetchone()[0])
    cur.execute("SELECT COUNT(*) FROM test_cases")
    print("Total Test Cases:", cur.fetchone()[0])
    cur.execute("SELECT COUNT(*) FROM hints")
    print("Total Hints:", cur.fetchone()[0])
    cur.execute("SELECT difficulty, COUNT(*) FROM problems GROUP BY difficulty")
    print("Difficulty Distribution:", cur.fetchall())

def main():
    db_path = "db/problems.db"
    json_path = "db/problems.json"
    
    if not os.path.exists(json_path):
        print(f"Error: {json_path} not found!")
        return
    
    conn = create_database(db_path)
    populate_database(conn, json_path)
    verify_database(conn)
    conn.close()

if __name__ == "__main__":
    main()
