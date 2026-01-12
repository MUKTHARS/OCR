import os
import json
from typing import List, Dict, Any, Optional
from sqlalchemy import create_engine, text
from datetime import datetime

class EnhancedRAGEngine:
    def __init__(self, db_url: Optional[str] = None):
        # Database connection
        if db_url:
            self.db_url = db_url
        else:
            self.db_url = os.getenv("DATABASE_URL", "postgresql://postgres:1234@localhost:5432/contract_db")
        
        self.engine = create_engine(self.db_url)
        
        # Initialize ChromaDB engine
        from .chroma_rag_engine import ChromaRAGEngine
        self.chroma_engine = ChromaRAGEngine()
    
    def create_embeddings(self, text: str, contract_id: int, version: int = 1) -> List[Dict[str, Any]]:
        """Create embeddings using ChromaDB"""
        print(f"Creating embeddings for contract {contract_id} using ChromaDB")
        return self.chroma_engine.create_embeddings(text, contract_id, version)
    
    def search_similar(self, query: str, contract_ids: Optional[List[int]] = None, top_k: int = 5) -> List[Dict[str, Any]]:
        """Search for similar content using ChromaDB"""
        print(f"Searching for similar content: '{query[:50]}...'")
        return self.chroma_engine.search_similar(query, contract_ids, top_k)
    
    def answer_query(self, query: str, context_chunks: List[Dict], contract_info: Optional[Dict] = None) -> Dict[str, Any]:
        """Answer query based on context chunks"""
        return self.chroma_engine.answer_query(query, context_chunks, contract_info)
    
    # Keep the existing database methods (they don't need to change)
    def search_by_metadata(self, filters: Dict[str, Any], limit: int = 10) -> List[Dict[str, Any]]:
        """Search contracts by metadata filters"""
        try:
            with self.engine.connect() as conn:
                base_query = """
                    SELECT DISTINCT c.* 
                    FROM contracts c
                    WHERE 1=1
                """
                
                params = {}
                conditions = []
                
                if filters.get("contract_type"):
                    conditions.append("c.contract_type ILIKE :contract_type")
                    params["contract_type"] = f"%{filters['contract_type']}%"
                
                if filters.get("parties"):
                    conditions.append("c.parties::text ILIKE :parties")
                    params["parties"] = f"%{filters['parties']}%"
                
                if filters.get("min_value"):
                    conditions.append("c.total_value >= :min_value")
                    params["min_value"] = filters["min_value"]
                
                if filters.get("max_value"):
                    conditions.append("c.total_value <= :max_value")
                    params["max_value"] = filters["max_value"]
                
                if filters.get("risk_level"):
                    if filters["risk_level"] == "high":
                        conditions.append("c.risk_score >= 0.7")
                    elif filters["risk_level"] == "medium":
                        conditions.append("c.risk_score BETWEEN 0.3 AND 0.7")
                    elif filters["risk_level"] == "low":
                        conditions.append("c.risk_score < 0.3")
                
                if conditions:
                    base_query += " AND " + " AND ".join(conditions)
                
                base_query += " ORDER BY c.extraction_date DESC LIMIT :limit"
                params["limit"] = limit
                
                results = conn.execute(text(base_query), params).fetchall()
                
                contracts = []
                for row in results:
                    contract_dict = dict(row._mapping)
                    contracts.append(contract_dict)
                
                return contracts
                
        except Exception as e:
            print(f"Error in metadata search: {e}")
            return []
    
    def get_contract_summary(self, contract_id: int) -> Dict[str, Any]:
        """Get comprehensive summary of a contract"""
        try:
            with self.engine.connect() as conn:
                contract_query = text("""
                    SELECT * FROM contracts WHERE id = :contract_id
                """)
                contract_result = conn.execute(contract_query, {"contract_id": contract_id}).fetchone()
                
                if not contract_result:
                    return {"error": "Contract not found"}
                
                contract = dict(contract_result._mapping)
                
                # Get stats from ChromaDB
                chroma_stats = self.chroma_engine.get_collection_stats()
                
                summary = {
                    "contract_id": contract_id,
                    "contract_type": contract.get("contract_type"),
                    "parties": contract.get("parties", []),
                    "total_value": contract.get("total_value"),
                    "currency": contract.get("currency"),
                    "risk_score": contract.get("risk_score"),
                    "confidence_score": contract.get("confidence_score"),
                    "extraction_metadata": {
                        "has_vector_embeddings": True,
                        "vector_db": "ChromaDB",
                        "vector_db_stats": chroma_stats,
                        "table_count": len(contract.get("extracted_tables_data", {}).get("tables", [])) if contract.get("extracted_tables_data") else 0,
                        "has_tables": bool(contract.get("extracted_tables_data"))
                    },
                    "dates": {
                        "effective": contract.get("effective_date"),
                        "expiration": contract.get("expiration_date"),
                        "extraction": contract.get("extraction_date")
                    }
                }
                
                return summary
                
        except Exception as e:
            print(f"Error getting contract summary: {e}")
            return {"error": str(e)}