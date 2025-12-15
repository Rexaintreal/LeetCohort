import sqlite3
import json
import os

DB_FILE = "db/problems.db" 
JSON_FILE = "db/problems.json"

def create_connection():
    try:
        if not os.path.exists(DB_FILE):
            print(f"Warning: Database file '{DB_FILE}' not found in current directory.")
            print("Please ensure you have initialized the database with the schema first.")        
        conn = sqlite3.connect(DB_FILE)
        return conn
    except sqlite3.Error as e:
        print(f"Error connecting to database: {e}")
        return None


def calculate_points(problem):
    difficulty_base = {
        "Easy": 10,
        "Medium": 20,
        "Hard": 40
    }

    points = difficulty_base.get(problem.get("difficulty", "Easy"), 10)

    test_cases = problem.get("test_cases", [])
    if len(test_cases) > 1:
        points += (len(test_cases) - 1) * 5

    hints = problem.get("hints", [])
    if not hints:
        points += 5

    if problem.get("order_matters", 1) == 0:
        points += 5

    return round_to_5(points)

def round_to_5(n):
    return int(round(n / 5) * 5)

def seed_database():
    conn = create_connection()
    if conn is None:
        return

    cursor = conn.cursor()
    try:
        with open(JSON_FILE, 'r') as f:
            problems_data = json.load(f)
    except FileNotFoundError:
        print(f"Error: {JSON_FILE} not found.")
        return
    except json.JSONDecodeError as e:
        print(f"Error decoding JSON: {e}")
        return

    print(f"Found {len(problems_data)} problems to insert.")

    inserted_count = 0
    skipped_count = 0

    for p in problems_data:
        try:
            sql_problem = '''
                INSERT INTO problems (
                    title, slug, description, input_format, output_format, 
                    difficulty, topic_tags, company_tags, constraints, 
                    boilerplate_code, points, order_matters,
                    time_complexity, space_complexity
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            '''
            
            val_problem = (
                p.get("title"),
                p.get("slug"),
                p.get("description"),
                p.get("input_format"),
                p.get("output_format"),
                p.get("difficulty"),
                p.get("topic_tags"),
                p.get("company_tags"),
                p.get("constraints"),
                p.get("boilerplate_code"),  
                calculate_points(p),
                p.get("order_matters", 1), 
                p.get("time_complexity"),
                p.get("space_complexity")
            )

            cursor.execute(sql_problem, val_problem)
            problem_id = cursor.lastrowid
            
            if "hints" in p and p["hints"]:
                for h in p["hints"]:
                    sql_hint = '''
                        INSERT INTO hints (problem_id, hint, display_order)
                        VALUES (?, ?, ?)
                    '''
                    cursor.execute(sql_hint, (problem_id, h["hint"], h["display_order"]))

            if "test_cases" in p and p["test_cases"]:
                for i, tc in enumerate(p["test_cases"]):
                    sql_tc = '''
                        INSERT INTO test_cases (
                            problem_id, input, expected_output, 
                            input_json, expected_output_json, 
                            is_sample, explanation, points, display_order
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    '''
                    
                    input_val = tc.get("input")
                    output_val = tc.get("expected_output")
                    input_json = tc.get("input_json")
                    output_json = tc.get("expected_output_json")
                    explanation = tc.get("explanation")
                    test_points = tc.get("points", 10) 
                    
                    cursor.execute(sql_tc, (
                        problem_id, 
                        input_val, 
                        output_val, 
                        input_json, 
                        output_json, 
                        tc.get("is_sample", 0), 
                        explanation,
                        test_points,
                        i + 1 
                    ))

            inserted_count += 1
            print(f"Inserted: {p['title']}")

        except sqlite3.IntegrityError as e:
            print(f"Skipping '{p['title']}' (likely already exists): {e}")
            skipped_count += 1
        except Exception as e:
            print(f"Error inserting '{p['title']}': {e}")
            import traceback
            traceback.print_exc()

    conn.commit()
    conn.close()
    
    print("-" * 50)
    print(f"Process Complete.")
    print(f"Inserted: {inserted_count}")
    print(f"Skipped:  {skipped_count}")

if __name__ == "__main__":
    seed_database()