from neo4j import GraphDatabase

# Connection details matching our docker-compose file
URI = "bolt://localhost:7687"
AUTH = ("neo4j", "cosmicmind123")

def test_connection():
    try:
        # Create a connection driver
        driver = GraphDatabase.driver(URI, auth=AUTH)
        driver.verify_connectivity()
        print("SUCCESS: The Cosmic Mind database is online and Python is connected!")
        driver.close()
    except Exception as e:
        print(f"ERROR: Could not connect to the database. Details: {e}")

if __name__ == "__main__":
    test_connection()