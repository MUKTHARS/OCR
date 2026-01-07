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
    
    # Clauses and Fields - CHANGED: metadata -> extracted_metadata
    clauses = Column(JSON)
    key_fields = Column(JSON)
    extracted_metadata = Column(JSON, nullable=True)  # Changed from 'metadata' to 'extracted_metadata'
    
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

class ContractDelta(Base):
    __tablename__ = "contract_deltas"
    
    id = Column(Integer, primary_key=True, index=True)
    contract_id = Column(Integer, ForeignKey('contracts.id'), index=True)
    previous_version_id = Column(Integer, ForeignKey('contracts.id'), nullable=True)
    field_name = Column(String, index=True)
    old_value = Column(JSON, nullable=True)
    new_value = Column(JSON, nullable=True)
    change_type = Column(String)
    confidence_change = Column(Float, nullable=True)
    detected_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationship
    contract = relationship("Contract", foreign_keys=[contract_id])

class RAGEmbedding(Base):
    __tablename__ = "rag_embeddings"
    
    id = Column(Integer, primary_key=True, index=True)
    contract_id = Column(Integer, ForeignKey('contracts.id'), index=True)
    text_chunk = Column(Text)
    embedding = Column(JSON)
    chunk_metadata = Column(JSON)  # Already using chunk_metadata, not metadata
    version = Column(Integer, default=1)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationship
    contract = relationship("Contract")