from flask import Flask, request, jsonify
from flask_cors import CORS
from neo4j import GraphDatabase
from sentence_transformers import SentenceTransformer
import re

app = Flask(__name__)
CORS(app)

URI = "bolt://localhost:7687"
AUTH = ("neo4j", "cosmicmind123")
driver = GraphDatabase.driver(URI, auth=AUTH)

print("Loading Semantic AI Model...")
model = SentenceTransformer('all-MiniLM-L6-v2')
print("Model loaded. Ready for queries.")

@app.route('/search', methods=['POST'])
def search():
    data = request.json
    query = data.get('query', '')
    
    # Extract keywords to help the math out
    stop_words = ['about', 'what', 'where', 'when', 'whose', 'please', 'explain', 'the', 'and', 'for', 'with', 'from', 'this', 'that', 'does']
    words = [w.lower() for w in re.findall(r'\b\w+\b', query) if len(w) >= 3 and w.lower() not in stop_words]
    strong_keyword = words[-1] if words else "god"
    
    query_embedding = model.encode(query).tolist()
    
    with driver.session() as session:
        result = session.run("""
            MATCH (v:Verse)
            WHERE v.embedding IS NOT NULL
            
            // Vector Math
            WITH v, REDUCE(s = 0.0, i IN RANGE(0, SIZE(v.embedding)-1) | s + v.embedding[i] * $embedding[i]) AS math_score
            
            // Keyword Boost
            WITH v, math_score,
                 CASE WHEN toLower(v.english) CONTAINS $keyword THEN 0.5 ELSE 0.0 END AS keyword_bonus
            
            ORDER BY (math_score + keyword_bonus) DESC
            LIMIT 5 
            
            // THE FIX: Traverse the graph backward to find the Chapter node that owns this Verse
            MATCH (c:Chapter)-[:HAS_VERSE]->(v)
            
            // Return the structured properties correctly
            // (Hardcoding "Genesis" as a fallback in case your graph doesn't have Book nodes yet)
            RETURN "Genesis" AS book, c.number AS chapter, v.number AS verse, v.english AS text
        """, embedding=query_embedding, keyword=strong_keyword)
        
        verses = []
        for record in result:
            clean_text = re.sub(r'<[^>]+>', '', record['text']) # Scrub HTML
            verses.append({
                "book": record.get("book", "Genesis"), # Fallback if your DB doesn't have the book property yet
                "chapter": record.get("chapter"),
                "verse": record.get("verse"),
                "text": clean_text
            })
        
        return jsonify({"verses": verses})

if __name__ == '__main__':
    app.run(port=5000)