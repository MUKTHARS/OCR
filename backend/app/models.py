from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, Float, JSON
from sqlalchemy.sql import func
from app.database import Base

class Document(Base):
    __tablename__ = "documents"
    
    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String, index=True)
    file_type = Column(String)
    file_size = Column(Integer)
    upload_date = Column(DateTime(timezone=True), server_default=func.now())
    status = Column(String, default="uploaded")  # uploaded, processing, completed, failed

class Contract(Base):
    __tablename__ = "contracts"
    
    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, index=True)
    contract_type = Column(String, index=True)  # NDA, Employment, Service, etc.
    parties = Column(JSON)  # List of parties involved
    effective_date = Column(DateTime)
    expiration_date = Column(DateTime)
    total_value = Column(Float, nullable=True)
    currency = Column(String(3), nullable=True)
    
    # Extracted clauses
    clauses = Column(JSON)  # {clause_name: text, confidence: float}
    key_fields = Column(JSON)  # {field_name: value, confidence: float}
    
    # Metadata
    extraction_date = Column(DateTime(timezone=True), server_default=func.now())
    confidence_score = Column(Float)
    needs_review = Column(Boolean, default=True)
    reviewed_by = Column(String, nullable=True)
    review_date = Column(DateTime(timezone=True), nullable=True)
    
class RAGEmbedding(Base):
    __tablename__ = "rag_embeddings"
    
    id = Column(Integer, primary_key=True, index=True)
    contract_id = Column(Integer, index=True)
    text_chunk = Column(Text)
    embedding = Column(JSON)  # Store vector embeddings
    chunk_metadata = Column(JSON)   # Page number, section, etc.
    created_at = Column(DateTime(timezone=True), server_default=func.now())