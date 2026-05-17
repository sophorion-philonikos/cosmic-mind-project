import { NextResponse } from 'next/server';
import neo4j from 'neo4j-driver';

const URI = 'bolt://localhost:7687';
const USER = 'neo4j';
const PASSWORD = 'cosmicmind123';

const driver = neo4j.driver(URI, neo4j.auth.basic(USER, PASSWORD));

export async function GET() {
  const session = driver.session();
  try {
    // STRICT QUERY: First gather all stars, then only gather valid, complete gravity lines.
    const result = await session.run(`
      MATCH (n:Verse)
      WITH collect(distinct {id: n.id, text: n.english}) as nodes
      MATCH (s:Verse)-[r:RELATED_TO]-(t:Verse)
      WITH nodes, collect(distinct {source: s.id, target: t.id, weight: r.weight}) as links
      RETURN nodes, links
    `);

    const record = result.records[0];
    const nodes = record.get('nodes');
    const links = record.get('links');

    return NextResponse.json({ nodes, links });
  } catch (error) {
    console.error('Neo4j Error:', error);
    return NextResponse.json({ error: 'Failed to fetch graph data' }, { status: 500 });
  } finally {
    await session.close();
  }
}