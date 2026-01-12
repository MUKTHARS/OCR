-- Create database
CREATE DATABASE contract_db;

-- Connect to database
\c contract_db;

-- Enable UUID extension if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Documents table (already defined in models, but here's SQL)
CREATE TABLE IF NOT EXISTS documents (
    id SERIAL PRIMARY KEY,
    filename VARCHAR(255) NOT NULL,
    file_type VARCHAR(50),
    file_size INTEGER,
    upload_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(50) DEFAULT 'uploaded'
);

-- Contracts table
CREATE TABLE IF NOT EXISTS contracts (
    id SERIAL PRIMARY KEY,
    document_id INTEGER REFERENCES documents(id),
    contract_type VARCHAR(100),
    parties JSONB,
    effective_date TIMESTAMP WITH TIME ZONE,
    expiration_date TIMESTAMP WITH TIME ZONE,
    total_value DECIMAL(15,2),
    currency CHAR(3),
    clauses JSONB,
    key_fields JSONB,
    extraction_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    confidence_score DECIMAL(3,2),
    needs_review BOOLEAN DEFAULT TRUE,
    reviewed_by VARCHAR(255),
    review_date TIMESTAMP WITH TIME ZONE
);

-- RAG embeddings table
CREATE TABLE IF NOT EXISTS rag_embeddings (
    id SERIAL PRIMARY KEY,
    contract_id INTEGER REFERENCES contracts(id),
    text_chunk TEXT,
    embedding JSONB,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX idx_documents_filename ON documents(filename);
CREATE INDEX idx_contracts_type ON contracts(contract_type);
CREATE INDEX idx_contracts_review ON contracts(needs_review);
CREATE INDEX idx_rag_contract_id ON rag_embeddings(contract_id);

-- For vector similarity search (if using pgvector)
-- CREATE EXTENSION vector;
-- ALTER TABLE rag_embeddings ADD COLUMN embedding_vector vector(1536);

