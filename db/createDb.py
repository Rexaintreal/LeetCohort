import sqlite3
import os

DB_FILE = "problems.db"

def create_schema():
    if os.path.exists(DB_FILE):
        os.remove(DB_FILE)
        print(f"Removed existing database '{DB_FILE}'")

    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()

    cursor.execute("PRAGMA foreign_keys = ON;")

    print("Creating tables...")

    create_problems_sql = """
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
        check_complexity INTEGER DEFAULT 0,  -- Added here
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """
    cursor.execute(create_problems_sql)
    print(" - Table 'problems' created (Python-only).")

    create_hints_sql = """
    CREATE TABLE hints (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        problem_id INTEGER NOT NULL,
        hint TEXT NOT NULL,
        display_order INTEGER DEFAULT 0,
        FOREIGN KEY (problem_id) REFERENCES problems(id) ON DELETE CASCADE
    );
    """
    cursor.execute(create_hints_sql)
    print(" - Table 'hints' created.")

    create_test_cases_sql = """
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
    """
    cursor.execute(create_test_cases_sql)
    print(" - Table 'test_cases' created.")

    conn.commit()
    conn.close()
    print(f"Database '{DB_FILE}' initialized successfully.")

if __name__ == "__main__":
    create_schema()