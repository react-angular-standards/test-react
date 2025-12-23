"""
Neo4j Graph Database Configuration
"""

import logging
import os

from dotenv import load_dotenv
from neo4j import GraphDatabase

load_dotenv()

logger = logging.getLogger(__name__)

# Neo4j connection details from environment variables
NEO4J_URI = os.getenv("NEO4J_URI")
NEO4J_USERNAME = os.getenv("NEO4J_USERNAME")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD")

# Singleton instance
_graphdb_instance = None


class GraphDB:
    """Neo4j Graph Database wrapper"""

    def __init__(self, uri: str, username: str, password: str):
        """Initialize Neo4j driver"""
        try:
            self.driver = GraphDatabase.driver(uri, auth=(username, password))
            # Test connection
            self.driver.verify_connectivity()
            logger.info(f"✅ Connected to Neo4j at {uri}")
        except Exception as e:
            logger.error(f"❌ Failed to connect to Neo4j: {e}")
            raise

    def close(self):
        """Close the driver connection"""
        if self.driver:
            self.driver.close()
            logger.info("Neo4j connection closed")

    def execute_query(self, query: str, parameters: dict = None):
        """Execute a Cypher query and return results"""
        with self.driver.session() as session:
            result = session.run(query, parameters or {})
            return [record.data() for record in result]

    def execute_write(self, query: str, parameters: dict = None):
        """Execute a write transaction"""
        with self.driver.session() as session:
            result = session.write_transaction(
                lambda tx: tx.run(query, parameters or {})
            )
            return result


def get_graphdb() -> GraphDB:
    """Get or create GraphDB singleton instance"""
    global _graphdb_instance

    if _graphdb_instance is None:
        if not all([NEO4J_URI, NEO4J_USERNAME, NEO4J_PASSWORD]):
            raise ValueError(
                "Missing Neo4j configuration. Please set NEO4J_URI, NEO4J_USERNAME, and NEO4J_PASSWORD in .env"
            )

        _graphdb_instance = GraphDB(NEO4J_URI, NEO4J_USERNAME, NEO4J_PASSWORD)

    return _graphdb_instance
