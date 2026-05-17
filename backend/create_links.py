from neo4j import GraphDatabase
from sentence_transformers import SentenceTransformer
import numpy as np
from tqdm import tqdm

URI = "bolt://localhost:7687"
AUTH = ("neo4j", "cosmicmind123")

# This model is small (under 100MB) but very smart. 
# It will download once and then work offline forever.
model = SentenceTransformer('all-MiniLM-L6-v2')

def cluster_verses():
    driver = GraphDatabase.driver(URI, auth=AUTH)
    with driver.session() as session:
        # 1. Fetch all verses from your local database
        print("Fetching verses from the Cosmic Mind...")
        result = session.run("MATCH (v:Verse) RETURN v.id as id, v.english as text")
        records = [record for record in result]
        
        if not records:
            print("No verses found! Did you run the ingester?")
            return

        texts = [r['text'] for r in records]
        ids = [r['id'] for r in records]
        
        # 2. Turn text into mathematical coordinates (Embeddings)
        print(f"Generating semantic coordinates for {len(texts)} verses...")
        embeddings = model.encode(texts, show_progress_bar=True)

        # 3. Create links between verses that are 'close' in meaning
        print("Calculating gravity and drawing connections...")
        
        # We use a 'similarity' threshold. 0.75 means 75% similar in meaning.
        # This creates the 'constellations'.
        for i in tqdm(range(len(embeddings)), desc="Linking Stars"):
            for j in range(i + 1, len(embeddings)):
                # Calculate how similar these two verses are
                dot_product = np.dot(embeddings[i], embeddings[j])
                norm_a = np.linalg.norm(embeddings[i])
                norm_b = np.linalg.norm(embeddings[j])
                similarity = dot_product / (norm_a * norm_b)
                
                if similarity > 0.75:
                    session.run("""
                        MATCH (v1:Verse {id: $id1})
                        MATCH (v2:Verse {id: $id2})
                        MERGE (v1)-[r:RELATED_TO]-(v2)
                        SET r.weight = $sim
                    """, id1=ids[i], id2=ids[j], sim=float(similarity))
                    
    driver.close()
    print("\nSUCCESS: Gravity established. Your stars are now a Mind Map.")

if __name__ == "__main__":
    cluster_verses()