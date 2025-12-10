import sqlite3
import json

with open("problems.json", "r", encoding="utf-8") as f:
    problems = json.load(f)

conn = sqlite3.connect("problems.db")
cur = conn.cursor()
cur.execute("""
CREATE TABLE IF NOT EXISTS problems (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT NOT NULL,
    difficulty TEXT CHECK(difficulty IN ('Easy','Medium','Hard')),
    boilerplate_code TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
""")

cur.execute("""
CREATE TABLE IF NOT EXISTS test_cases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    problem_id INTEGER NOT NULL,
    input TEXT NOT NULL,
    expected_output TEXT NOT NULL,
    points INTEGER DEFAULT 10,
    FOREIGN KEY (problem_id) REFERENCES problems(id)
)
""")

cur.execute("""
CREATE TABLE IF NOT EXISTS hints (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    problem_id INTEGER NOT NULL,
    hint TEXT NOT NULL,
    FOREIGN KEY (problem_id) REFERENCES problems(id)
)
""")
for prob in problems:

    slug = prob["slug"]
    cur.execute("SELECT id FROM problems WHERE slug = ?", (slug,))
    existing = cur.fetchone()

    if existing:
        problem_id = existing[0]
        print(f"Skipping (already exists): {slug}")
    else:
        cur.execute("""
            INSERT INTO problems (title, slug, description, difficulty, boilerplate_code)
            VALUES (?, ?, ?, ?, ?)
        """, (
            prob["title"],
            slug,
            prob["description"],
            prob["difficulty"],
            prob["boilerplate_code"]
        ))
        problem_id = cur.lastrowid
        print(f"Inserted: {slug} (ID={problem_id})")
    for tc in prob["test_cases"]:
        cur.execute("""
            INSERT INTO test_cases (problem_id, input, expected_output)
            VALUES (?, ?, ?)
        """, (
            problem_id,
            tc["input"],
            tc["expected_output"]
        ))
    for hint in prob["hints"]:
        cur.execute("""
            INSERT INTO hints (problem_id, hint)
            VALUES (?, ?)
        """, (
            problem_id,
            hint
        ))

conn.commit()
conn.close()
print("\nAll problems imported successfully.")
