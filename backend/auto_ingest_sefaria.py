import requests
from neo4j import GraphDatabase
from tqdm import tqdm

URI = "bolt://localhost:7687"
AUTH = ("neo4j", "cosmicmind123")

def run_ingestion(book_name):
    driver = GraphDatabase.driver(URI, auth=AUTH)
    
    print(f"Fetching {book_name} from Sefaria (V1 API)...")
    api_url = f"https://www.sefaria.org/api/texts/{book_name}?pad=0"
    response = requests.get(api_url).json()
    
    english_chapters = response.get('text', [])
    hebrew_chapters = response.get('he', [])
    
    with driver.session() as session:
        print(f"Ingesting {book_name} into the Cosmic Mind...")
        
        # We loop through the English chapters
        for c_idx, chapter in enumerate(tqdm(english_chapters, desc="Chapters")):
            chapter_num = c_idx + 1
            
            # Shock Absorber 1: If the chapter is just a string, wrap it in a list
            if isinstance(chapter, str):
                verses = [chapter]
            else:
                verses = chapter
                
            # Shock Absorber 2: Do the same for the Hebrew chapter safely
            try:
                he_chap = hebrew_chapters[c_idx]
                if isinstance(he_chap, str):
                    he_verses = [he_chap] # Handles the empty string crash
                else:
                    he_verses = he_chap
            except IndexError:
                he_verses = []
                
            for v_idx, verse_text in enumerate(verses):
                verse_num = v_idx + 1
                
                # Shock Absorber 3: Safely get the Hebrew verse
                try:
                    hebrew_text = he_verses[v_idx]
                except IndexError:
                    hebrew_text = ""
                
                query = """
                MERGE (b:Book {name: $book_name})
                MERGE (c:Chapter {number: $chapter_num, book: $book_name})
                MERGE (b)-[:HAS_CHAPTER]->(c)
                CREATE (v:Verse {
                    number: $verse_num, 
                    english: $eng, 
                    hebrew: $heb,
                    id: $book_name + "_" + $chapter_num + "_" + $verse_num
                })
                MERGE (c)-[:HAS_VERSE]->(v)
                """
                session.run(query, 
                            book_name=book_name, 
                            chapter_num=chapter_num, 
                            verse_num=verse_num, 
                            eng=str(verse_text), 
                            heb=str(hebrew_text))
    
    driver.close()
    print(f"\nSUCCESS: {book_name} is now offline in your local database.")

if __name__ == "__main__":
    run_ingestion("Genesis")