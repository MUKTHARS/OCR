from fastapi import FastAPI, UploadFile, File, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List
import os
from dotenv import load_dotenv
from app.database import get_db, engine
# from database import get_db, engine
from . import models
from . import schemas
from .agents.contract_processor import ContractProcessor
from .agents.rag_engine import RAGEngine
load_dotenv()

app = FastAPI(title="Contract Intelligence Agent")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("ALLOWED_ORIGINS", "*").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize models
models.Base.metadata.create_all(bind=engine)

processor = ContractProcessor()
rag_engine = RAGEngine()


@app.post("/upload", response_model=schemas.DocumentResponse)
async def upload_document(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """Upload a contract document"""
    print(f"Backend: Received upload request for file: {file.filename}")
    try:
        # Read file
        contents = await file.read()
        print(f"Backend: File size: {len(contents)} bytes")
        
        # Validate file type
        if not file.filename.lower().endswith('.pdf'):
            raise HTTPException(status_code=400, detail="Only PDF files are supported")
        
        # Save document record
        db_document = models.Document(
            filename=file.filename,
            file_type=file.content_type,
            file_size=len(contents),
            status="uploaded"
        )
        db.add(db_document)
        db.commit()
        db.refresh(db_document)
        print(f"Backend: Document saved with ID: {db_document.id}")
        
        # IMPORTANT: Extract text synchronously first to ensure it works
        text = processor.extract_text_from_pdf(contents)
        if not text or len(text.strip()) < 50:
            db_document.status = "failed: Could not extract text from PDF"
            db.commit()
            raise HTTPException(
                status_code=400, 
                detail="Could not extract text from PDF. The file might be scanned or corrupted."
            )
        
        print(f"Backend: Text extraction successful, starting async processing")
        
        # Process asynchronously
        import threading
        thread = threading.Thread(
            target=process_document_async,
            args=(db_document.id, contents, db)
        )
        thread.daemon = True
        thread.start()
        print(f"Backend: Started async processing for document {db_document.id}")
        
        # Return immediate response
        return db_document
        
    except Exception as e:
        print(f"Backend: Upload error: {str(e)}")
        import traceback
        traceback.print_exc()
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=str(e))

        
@app.get("/contracts", response_model=List[schemas.ContractResponse])
async def get_contracts(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """Get all contracts"""
    contracts = db.query(models.Contract)\
        .offset(skip)\
        .limit(limit)\
        .all()
    return contracts

@app.get("/contracts/{contract_id}", response_model=schemas.ContractResponse)
async def get_contract(
    contract_id: int,
    db: Session = Depends(get_db)
):
    """Get specific contract"""
    contract = db.query(models.Contract)\
        .filter(models.Contract.id == contract_id)\
        .first()
    
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")
    
    return contract

@app.post("/search")
async def search_contracts(
    query: schemas.SearchQuery,
    db: Session = Depends(get_db)
):
    """Search contracts using RAG"""
    # Get all embeddings
    embeddings = db.query(models.RAGEmbedding).all()
    
    if not embeddings:
        return {"results": []}
    
    # Search similar
    embedding_list = [e.embedding for e in embeddings]
    similar_indices = rag_engine.search_similar(query.query, embedding_list)
    
    # Get relevant contracts
    results = []
    for idx in similar_indices:
        emb = embeddings[idx]
        contract = db.query(models.Contract)\
            .filter(models.Contract.id == emb.contract_id)\
            .first()
        
        if contract:
            # Generate answer
            answer = rag_engine.answer_query(query.query, emb.text_chunk)
            results.append({
                "contract_id": contract.id,
                "contract_type": contract.contract_type,
                "relevance_text": answer,
                "confidence": 0.85  # Placeholder
            })
    
    return {"results": results[:query.limit]}

@app.post("/contracts/{contract_id}/review")
async def review_contract(
    contract_id: int,
    reviewed: bool = True,
    db: Session = Depends(get_db)
):
    """Mark contract as reviewed"""
    contract = db.query(models.Contract)\
        .filter(models.Contract.id == contract_id)\
        .first()
    
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")
    
    contract.needs_review = not reviewed
    db.commit()
    
    return {"status": "success"}

def process_document_async(document_id: int, file_content: bytes, db: Session):
    """Async processing function"""
    try:
        print(f"Starting async processing for document {document_id}")
        
        # Get fresh database session for this thread
        from app.database import SessionLocal
        local_db = SessionLocal()
        
        try:
            # Update status
            document = local_db.query(models.Document)\
                .filter(models.Document.id == document_id)\
                .first()
            
            if not document:
                print(f"Document {document_id} not found")
                return
                
            document.status = "processing"
            local_db.commit()
            
            print(f"Extracting text from PDF for document {document_id}")
            # Extract text
            text = processor.extract_text_from_pdf(file_content)
            
            if not text or len(text.strip()) < 50:
                print(f"No substantial text extracted from document {document_id}")
                document.status = "failed"
                document.status = "No text extracted"
                local_db.commit()
                return
            
            print(f"Text extracted, length: {len(text)} characters")
            
            # Process contract
            print(f"Processing contract with OpenAI for document {document_id}")
            extraction = processor.process_contract(text)
            validation = processor.validate_extraction(extraction)
            
            print(f"Extraction completed, confidence: {extraction.get('confidence_score')}")
            
            # Save contract
            contract = models.Contract(
                document_id=document_id,
                contract_type=extraction.get("contract_type", "Unknown"),
                parties=extraction.get("parties", []),
                effective_date=extraction.get("effective_date"),
                expiration_date=extraction.get("expiration_date"),
                total_value=extraction.get("total_value"),
                currency=extraction.get("currency"),
                clauses=extraction.get("clauses", {}),
                key_fields=extraction.get("key_fields", {}),
                confidence_score=extraction.get("confidence_score", 0.0)
            )
            local_db.add(contract)
            local_db.commit()
            local_db.refresh(contract)
            
            print(f"Contract saved with ID: {contract.id}")
            
            # Create embeddings for RAG
            print(f"Creating embeddings for contract {contract.id}")
            rag = RAGEngine()
            embeddings = rag.create_embeddings(text)
            
            for emb in embeddings:
                rag_entry = models.RAGEmbedding(
                    contract_id=contract.id,
                    text_chunk=emb["text_chunk"],
                    embedding=emb["embedding"],
                    chunk_metadata=emb["metadata"] 
                )
                local_db.add(rag_entry)
            
            local_db.commit()
            
            # Update document status
            document.status = "completed"
            local_db.commit()
            
            print(f"Document {document_id} processing completed successfully")
            
        except Exception as e:
            print(f"Error processing document {document_id}: {str(e)}")
            import traceback
            traceback.print_exc()
            
            # Update document status to failed
            try:
                document = local_db.query(models.Document)\
                    .filter(models.Document.id == document_id)\
                    .first()
                if document:
                    document.status = f"failed: {str(e)[:100]}"
                    local_db.commit()
            except:
                pass
        finally:
            local_db.close()
            
    except Exception as e:
        print(f"Outer error in async processing: {str(e)}")
        import traceback
        traceback.print_exc()

        