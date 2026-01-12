from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, Float, JSON, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database import Base

class Document(Base):
    __tablename__ = "documents"
    
    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String, index=True)
    file_type = Column(String)
    file_size = Column(Integer)
    upload_date = Column(DateTime(timezone=True), server_default=func.now())
    status = Column(String, default="uploaded")
    version = Column(Integer, default=1)
    parent_document_id = Column(Integer, ForeignKey('documents.id'), nullable=True)
    is_amendment = Column(Boolean, default=False)
    amendment_type = Column(String, nullable=True)
    processing_attempts = Column(Integer, default=0)
    last_processing_error = Column(Text, nullable=True)
    
    # Relationships
    contracts = relationship("Contract", back_populates="document")
    parent = relationship("Document", remote_side=[id], backref="amendments")

class Contract(Base):
    __tablename__ = "contracts"
    
    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey('documents.id'), index=True)
    contract_type = Column(String, index=True)
    contract_subtype = Column(String, nullable=True)
    master_agreement_id = Column(String, nullable=True, index=True)
    parties = Column(JSON)
    effective_date = Column(DateTime)
    expiration_date = Column(DateTime)
    execution_date = Column(DateTime, nullable=True)
    termination_date = Column(DateTime, nullable=True)
    
    # Financial Information
    total_value = Column(Float, nullable=True)
    currency = Column(String(3), nullable=True)
    payment_terms = Column(String, nullable=True)
    billing_frequency = Column(String, nullable=True)
    
    # Contact Information
    signatories = Column(JSON, nullable=True)
    contacts = Column(JSON, nullable=True)
    
    # Key Metrics
    auto_renewal = Column(Boolean, nullable=True)
    renewal_notice_period = Column(Integer, nullable=True)
    termination_notice_period = Column(Integer, nullable=True)
    governing_law = Column(String, nullable=True)
    jurisdiction = Column(String, nullable=True)
    
    # Security & Compliance
    confidentiality = Column(Boolean, nullable=True)
    indemnification = Column(Boolean, nullable=True)
    liability_cap = Column(String, nullable=True)
    insurance_requirements = Column(String, nullable=True)
    
    # Technical Details
    service_levels = Column(JSON, nullable=True)
    deliverables = Column(JSON, nullable=True)
    
    # Risk Indicators
    risk_score = Column(Float, default=0.0)
    risk_factors = Column(JSON, nullable=True)
    
    # Clauses and Fields
    clauses = Column(JSON)
    key_fields = Column(JSON)
    extracted_metadata = Column(JSON, nullable=True)
    
    # NEW: Table extraction data
    extracted_tables_data = Column(JSON, nullable=True)  # Add this line
    
    # Tracking
    extraction_date = Column(DateTime(timezone=True), server_default=func.now())
    confidence_score = Column(Float)
    needs_review = Column(Boolean, default=True)
    reviewed_by = Column(String, nullable=True)
    review_date = Column(DateTime(timezone=True), nullable=True)
    last_updated = Column(DateTime(timezone=True), onupdate=func.now())
    version = Column(Integer, default=1)
    previous_version_id = Column(Integer, ForeignKey('contracts.id'), nullable=True)
    change_summary = Column(Text, nullable=True)
    
    # Relationships
    document = relationship("Document", back_populates="contracts")
    previous_version = relationship("Contract", remote_side=[id], backref="next_versions")

    def to_dict(self):
        """Convert contract to dictionary for JSON serialization"""
        data = {}
        for column in self.__table__.columns:
            value = getattr(self, column.name)
            # Handle dates
            if isinstance(value, datetime):
                data[column.name] = value.isoformat()
            # Handle JSON fields
            elif isinstance(value, (dict, list)):
                data[column.name] = value
            else:
                data[column.name] = value
        return data

class RAGEmbedding(Base):
    __tablename__ = "rag_embeddings"
    
    id = Column(Integer, primary_key=True, index=True)
    contract_id = Column(Integer, ForeignKey('contracts.id'), index=True)
    text_chunk = Column(Text)
    embedding = Column(JSON)  # Keep for reference but won't be used for search
    chunk_metadata = Column(JSON)
    chroma_chunk_id = Column(String(255), nullable=True)  # Reference to ChromaDB
    vector_db_type = Column(String(50), default='chromadb')
    version = Column(Integer, default=1)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationship
    contract = relationship("Contract")