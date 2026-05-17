from neo4j import GraphDatabase
from sentence_transformers import SentenceTransformer
from tqdm import tqdm

URI = "bolt://localhost:7687"
AUTH = ("neo4j", "cosmicmind123")

# This is the exact same tiny, highly-optimized model we used for the gravity lines.
model = SentenceTransformer('all-MiniLM-L6-v2')

def upgrade_stars():
    driver = GraphDatabase.driver(URI, auth=AUTH)
    
    with driver.session() as session:
        print("Scanning the Cosmic Mind for unmapped stars...")
        # We only grab stars that don't have coordinates yet to save time
        result = session.run("MATCH (v:Verse) WHERE v.embedding IS NULL RETURN v.id AS id, v.english AS text")
        records = [record for record in result]
        
        if not records:
            print("All stars already have coordinates! You are ready to go.")
            return

        texts = [r['text'] for r in records]
        ids = [r['id'] for r in records]
        
        print(f"Calculating coordinates for {len(texts)} verses...")
        # This turns the English text into a 384-dimensional mathematical array
        embeddings = model.encode(texts, show_progress_bar=True)

        print("Injecting coordinates permanently into the database...")
        for i in tqdm(range(len(embeddings)), desc="Upgrading Stars"):
            session.run("""
                MATCH (v:Verse {id: $id})
                SET v.embedding = $emb
            """, id=ids[i], emb=embeddings[i].tolist())
            
    driver.close()
    print("\nSUCCESS: Your universe is now mathematically searchable.")

if __name__ == "__main__":
    upgrade_stars()