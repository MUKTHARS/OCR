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
import json
from datetime import datetime
from typing import Optional

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



@app.get("/contracts/summary")
async def get_contracts_summary(db: Session = Depends(get_db)):
    """Get comprehensive contract summary"""
    from sqlalchemy import func, case, and_
    from datetime import datetime, timedelta
    
    # Calculate statistics
    total_contracts = db.query(func.count(models.Contract.id)).scalar() or 0
    
    # Total value
    total_value_result = db.query(
        func.sum(
            case(
                (models.Contract.currency == 'USD', models.Contract.total_value),
                else_=0
            )
        )
    ).scalar() or 0
    
    # Expiring soon (within 90 days)
    ninety_days = datetime.now() + timedelta(days=90)
    expiring_soon = db.query(func.count(models.Contract.id)).filter(
        and_(
            models.Contract.expiration_date.isnot(None),
            models.Contract.expiration_date <= ninety_days
        )
    ).scalar() or 0
    
    # High risk contracts
    high_risk = db.query(func.count(models.Contract.id)).filter(
        models.Contract.risk_score >= 0.7
    ).scalar() or 0
    
    # Needs review
    needs_review = db.query(func.count(models.Contract.id)).filter(
        models.Contract.needs_review == True
    ).scalar() or 0
    
    # By type
    by_type = dict(db.query(
        models.Contract.contract_type,
        func.count(models.Contract.id)
    ).group_by(models.Contract.contract_type).all())
    
    # By status
    by_status = {
        "active": db.query(func.count(models.Contract.id)).filter(
            models.Contract.expiration_date > datetime.now()
        ).scalar() or 0,
        "expired": db.query(func.count(models.Contract.id)).filter(
            and_(
                models.Contract.expiration_date.isnot(None),
                models.Contract.expiration_date <= datetime.now()
            )
        ).scalar() or 0,
        "terminated": db.query(func.count(models.Contract.id)).filter(
            models.Contract.termination_date.isnot(None)
        ).scalar() or 0
    }
    
    return {
        "total_contracts": total_contracts,
        "total_value": float(total_value_result),
        "expiring_soon": expiring_soon,
        "high_risk": high_risk,
        "needs_review": needs_review,
        "by_type": by_type,
        "by_status": by_status
    }

@app.get("/contracts/{contract_id}/versions")
async def get_contract_versions(
    contract_id: int,
    db: Session = Depends(get_db)
):
    """Get all versions of a contract"""
    contract = db.query(models.Contract).filter(
        models.Contract.id == contract_id
    ).first()
    
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")
    
    # Find all versions (follow previous_version chain)
    versions = []
    current = contract
    
    while current:
        versions.append(current)
        if current.previous_version_id:
            current = db.query(models.Contract).filter(
                models.Contract.id == current.previous_version_id
            ).first()
        else:
            current = None
    
    versions.reverse()  # Oldest first
    return versions

@app.get("/contracts/{contract_id}/deltas")
async def get_contract_deltas(
    contract_id: int,
    version_from: Optional[int] = None,
    version_to: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """Get changes between contract versions"""
    contract = db.query(models.Contract).filter(
        models.Contract.id == contract_id
    ).first()
    
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")
    
    # Get specific versions or all deltas
    if version_from and version_to:
        deltas = db.query(models.ContractDelta).filter(
            and_(
                models.ContractDelta.contract_id == contract_id,
                models.ContractDelta.previous_version_id == version_from
            )
        ).all()
    else:
        deltas = db.query(models.ContractDelta).filter(
            models.ContractDelta.contract_id == contract_id
        ).order_by(models.ContractDelta.detected_at.desc()).all()
    
    return deltas

@app.get("/contracts/search/advanced")
async def advanced_search(
    query: Optional[str] = None,
    contract_type: Optional[str] = None,
    party_name: Optional[str] = None,
    min_value: Optional[float] = None,
    max_value: Optional[float] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    risk_level: Optional[str] = None,
    needs_review: Optional[bool] = None,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db)
):
    """Advanced contract search with filters"""
    from sqlalchemy import or_, and_
    
    query_builder = db.query(models.Contract)
    
    # Text search
    if query:
        query_builder = query_builder.filter(
            or_(
                models.Contract.contract_type.ilike(f"%{query}%"),
                models.Contract.parties.cast(String).ilike(f"%{query}%"),
                models.Contract.clauses.cast(String).ilike(f"%{query}%")
            )
        )
    
    # Type filter
    if contract_type:
        query_builder = query_builder.filter(
            models.Contract.contract_type == contract_type
        )
    
    # Party filter
    if party_name:
        query_builder = query_builder.filter(
            models.Contract.parties.cast(String).ilike(f"%{party_name}%")
        )
    
    # Value range filter
    if min_value is not None or max_value is not None:
        if min_value is not None and max_value is not None:
            query_builder = query_builder.filter(
                and_(
                    models.Contract.total_value >= min_value,
                    models.Contract.total_value <= max_value
                )
            )
        elif min_value is not None:
            query_builder = query_builder.filter(
                models.Contract.total_value >= min_value
            )
        elif max_value is not None:
            query_builder = query_builder.filter(
                models.Contract.total_value <= max_value
            )
    
    # Date range filter
    if start_date or end_date:
        date_filter = []
        if start_date:
            date_filter.append(models.Contract.effective_date >= start_date)
        if end_date:
            date_filter.append(models.Contract.expiration_date <= end_date)
        query_builder = query_builder.filter(and_(*date_filter))
    
    # Risk level filter
    if risk_level:
        risk_thresholds = {
            "low": (0.0, 0.3),
            "medium": (0.3, 0.7),
            "high": (0.7, 1.0)
        }
        if risk_level in risk_thresholds:
            min_risk, max_risk = risk_thresholds[risk_level]
            query_builder = query_builder.filter(
                and_(
                    models.Contract.risk_score >= min_risk,
                    models.Contract.risk_score <= max_risk
                )
            )
    
    # Review status filter
    if needs_review is not None:
        query_builder = query_builder.filter(
            models.Contract.needs_review == needs_review
        )
    
    # Execute query
    contracts = query_builder.offset(skip).limit(limit).all()
    total = query_builder.count()
    
    return {
        "total": total,
        "skip": skip,
        "limit": limit,
        "contracts": contracts
    }

# Update the existing process_document_async function
def process_document_async(document_id: int, file_content: bytes, db: Session, 
                          is_amendment: bool = False, parent_document_id: Optional[int] = None):
    """Enhanced async processing with versioning"""
    try:
        print(f"Starting enhanced async processing for document {document_id}")
        
        from app.database import SessionLocal
        local_db = SessionLocal()
        
        try:
            # Update document status
            document = local_db.query(models.Document)\
                .filter(models.Document.id == document_id)\
                .first()
            
            if not document:
                print(f"Document {document_id} not found")
                return
                
            document.status = "processing"
            local_db.commit()
            
            # Extract text with metadata
            print(f"Extracting text from PDF for document {document_id}")
            extraction_result = processor.extract_text_from_pdf(file_content)
            text = extraction_result["text"]
            pdf_metadata = extraction_result["metadata"]
            
            if not text or len(text.strip()) < 50:
                print(f"No substantial text extracted from document {document_id}")
                document.status = "failed: No text extracted"
                local_db.commit()
                return
            
            print(f"Text extracted, length: {len(text)} characters")
            
            # Process contract
            print(f"Processing contract with enhanced extraction")
            extraction = processor.process_contract(text, pdf_metadata)
            
            print(f"Extraction completed, confidence: {extraction.get('confidence_score')}")
            
            # Handle versioning if this is an amendment
            previous_contract = None
            version = 1
            
            if is_amendment and parent_document_id:
                # Find the latest version of the parent contract
                parent_doc = local_db.query(models.Document)\
                    .filter(models.Document.id == parent_document_id)\
                    .first()
                
                if parent_doc:
                    previous_contract = local_db.query(models.Contract)\
                        .filter(models.Contract.document_id == parent_doc.id)\
                        .order_by(models.Contract.version.desc())\
                        .first()
                    
                    if previous_contract:
                        version = previous_contract.version + 1
                        
                        # Compare versions
                        comparison = processor.compare_versions(
                            json.loads(json.dumps(previous_contract.clauses)),
                            extraction.get("clauses", {})
                        )
                        
                        # Store deltas
                        for delta in comparison.get("deltas", []):
                            contract_delta = models.ContractDelta(
                                contract_id=previous_contract.id,
                                previous_version_id=previous_contract.previous_version_id,
                                field_name=delta["field_name"],
                                old_value=delta["old_value"],
                                new_value=delta["new_value"],
                                change_type=delta["change_type"],
                                confidence_change=comparison.get("confidence_change")
                            )
                            local_db.add(contract_delta)
            
            # Save contract with all extracted fields
            contract = models.Contract(
                document_id=document_id,
                contract_type=extraction.get("contract_type", "Unknown"),
                contract_subtype=extraction.get("contract_subtype"),
                master_agreement_id=extraction.get("master_agreement_id"),
                parties=extraction.get("parties", []),
                effective_date=extraction.get("dates", {}).get("effective_date"),
                expiration_date=extraction.get("dates", {}).get("expiration_date"),
                execution_date=extraction.get("dates", {}).get("execution_date"),
                termination_date=extraction.get("dates", {}).get("termination_date"),
                total_value=extraction.get("financial", {}).get("total_value"),
                currency=extraction.get("financial", {}).get("currency"),
                payment_terms=extraction.get("financial", {}).get("payment_terms"),
                billing_frequency=extraction.get("financial", {}).get("billing_frequency"),
                signatories=extraction.get("signatories", []),
                contacts=extraction.get("contacts", []),
                auto_renewal=extraction.get("legal_terms", {}).get("auto_renewal"),
                renewal_notice_period=extraction.get("legal_terms", {}).get("renewal_notice_period"),
                termination_notice_period=extraction.get("legal_terms", {}).get("termination_notice_period"),
                governing_law=extraction.get("legal_terms", {}).get("governing_law"),
                jurisdiction=extraction.get("legal_terms", {}).get("jurisdiction"),
                confidentiality=extraction.get("legal_terms", {}).get("confidentiality"),
                indemnification=extraction.get("legal_terms", {}).get("indemnification"),
                liability_cap=extraction.get("legal_terms", {}).get("liability_cap"),
                insurance_requirements=extraction.get("legal_terms", {}).get("insurance_requirements"),
                service_levels=extraction.get("service_levels", {}),
                deliverables=extraction.get("deliverables", []),
                risk_score=extraction.get("risk_score", 0.0),
                risk_factors=extraction.get("risk_factors", []),
                clauses=extraction.get("clauses", {}),
                key_fields=extraction.get("key_fields", {}),
                extracted_metadata=extraction.get("metadata", {}),  # Changed from 'metadata' to 'extracted_metadata'
                confidence_score=extraction.get("confidence_score", 0.0),
                version=version,
                previous_version_id=previous_contract.id if previous_contract else None,
                change_summary=f"Amendment detected with {len(extraction.get('clauses', {}))} clauses" if is_amendment else "Initial extraction"
            )
            
            local_db.add(contract)
            local_db.commit()
            local_db.refresh(contract)
            
            print(f"Contract saved with ID: {contract.id}, Version: {version}")
            
            # Create embeddings for RAG
            print(f"Creating embeddings for contract {contract.id}")
            rag = RAGEngine()
            embeddings = rag.create_embeddings(text)
            
            for emb in embeddings:
                rag_entry = models.RAGEmbedding(
                    contract_id=contract.id,
                    text_chunk=emb["text_chunk"],
                    embedding=emb["embedding"],
                    chunk_metadata=emb["metadata"],
                    version=version
                )
                local_db.add(rag_entry)
            
            local_db.commit()
            
            # Update document status
            document.status = "completed"
            document.version = version
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

# Update the upload endpoint to handle amendments
@app.post("/upload", response_model=schemas.DocumentResponse)
async def upload_document(
    file: UploadFile = File(...),
    is_amendment: bool = False,
    parent_document_id: Optional[int] = None,
    amendment_type: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Enhanced upload with amendment support"""
    print(f"Enhanced upload: {file.filename}, Amendment: {is_amendment}")
    
    try:
        contents = await file.read()
        print(f"File size: {len(contents)} bytes")
        
        # Validate
        if not file.filename.lower().endswith('.pdf'):
            raise HTTPException(status_code=400, detail="Only PDF files are supported")
        
        # Check parent document if amendment
        if is_amendment and parent_document_id:
            parent = db.query(models.Document).filter(
                models.Document.id == parent_document_id
            ).first()
            if not parent:
                raise HTTPException(status_code=404, detail="Parent document not found")
        
        # Save document
        db_document = models.Document(
            filename=file.filename,
            file_type=file.content_type,
            file_size=len(contents),
            status="uploaded",
            is_amendment=is_amendment,
            parent_document_id=parent_document_id if is_amendment else None,
            amendment_type=amendment_type if is_amendment else None
        )
        db.add(db_document)
        db.commit()
        db.refresh(db_document)
        print(f"Document saved with ID: {db_document.id}")
        
        # Extract text synchronously for validation
        extraction_result = processor.extract_text_from_pdf(contents)
        # text = extraction_result["text"]
        text = processor.extract_text_from_pdf(contents)
        
        if not text or len(text.strip()) < 50:
            db_document.status = "failed: Could not extract text"
            db.commit()
            raise HTTPException(
                status_code=400, 
                detail="Could not extract text from PDF"
            )
        
        print(f"Text extraction successful, starting async processing")
        
        # Process asynchronously with amendment info
        import threading
        thread = threading.Thread(
            target=process_document_async,
            args=(db_document.id, contents, db, is_amendment, parent_document_id),
            kwargs={} 
        )
        thread.daemon = True
        thread.start()
        
        return db_document
        
    except Exception as e:
        print(f"Upload error: {str(e)}")
        import traceback
        traceback.print_exc()
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=str(e))


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
      

def process_document_async(document_id: int, file_content: bytes, db: Session, 
                          is_amendment: bool = False, parent_document_id: Optional[int] = None):
    """Async processing function - FIXED VERSION"""
    try:
        print(f"Starting async processing for document {document_id}, Amendment: {is_amendment}")
        
        from app.database import SessionLocal
        local_db = SessionLocal()
        
        try:
            # Update document status
            document = local_db.query(models.Document)\
                .filter(models.Document.id == document_id)\
                .first()
            
            if not document:
                print(f"Document {document_id} not found")
                return
                
            document.status = "processing"
            local_db.commit()
            
            # Extract text - FIXED: Now returns string, not dict
            print(f"Extracting text from PDF for document {document_id}")
            text = processor.extract_text_from_pdf(file_content)
            
            if not text or len(text.strip()) < 50:
                print(f"No substantial text extracted from document {document_id}")
                document.status = "failed: No text extracted"
                local_db.commit()
                return
            
            print(f"Text extracted, length: {len(text)} characters")
            
            # Process contract - FIXED: Pass text only, not metadata
            print(f"Processing contract with enhanced extraction")
            extraction = processor.process_contract(text)
            
            print(f"Extraction completed, confidence: {extraction.get('confidence_score')}")
            
            # Handle versioning if this is an amendment
            previous_contract = None
            version = 1
            
            if is_amendment and parent_document_id:
                # Find the latest version of the parent contract
                parent_doc = local_db.query(models.Document)\
                    .filter(models.Document.id == parent_document_id)\
                    .first()
                
                if parent_doc:
                    previous_contract = local_db.query(models.Contract)\
                        .filter(models.Contract.document_id == parent_doc.id)\
                        .order_by(models.Contract.version.desc())\
                        .first()
                    
                    if previous_contract:
                        version = previous_contract.version + 1
            
            # Save contract with all extracted fields
            contract = models.Contract(
                document_id=document_id,
                contract_type=extraction.get("contract_type", "Unknown"),
                contract_subtype=extraction.get("contract_subtype"),
                master_agreement_id=extraction.get("master_agreement_id"),
                parties=extraction.get("parties", []),
                effective_date=extraction.get("dates", {}).get("effective_date"),
                expiration_date=extraction.get("dates", {}).get("expiration_date"),
                execution_date=extraction.get("dates", {}).get("execution_date"),
                termination_date=extraction.get("dates", {}).get("termination_date"),
                total_value=extraction.get("financial", {}).get("total_value"),
                currency=extraction.get("financial", {}).get("currency"),
                payment_terms=extraction.get("financial", {}).get("payment_terms"),
                billing_frequency=extraction.get("financial", {}).get("billing_frequency"),
                signatories=extraction.get("signatories", []),
                contacts=extraction.get("contacts", []),
                auto_renewal=extraction.get("legal_terms", {}).get("auto_renewal"),
                renewal_notice_period=extraction.get("legal_terms", {}).get("renewal_notice_period"),
                termination_notice_period=extraction.get("legal_terms", {}).get("termination_notice_period"),
                governing_law=extraction.get("legal_terms", {}).get("governing_law"),
                jurisdiction=extraction.get("legal_terms", {}).get("jurisdiction"),
                confidentiality=extraction.get("legal_terms", {}).get("confidentiality"),
                indemnification=extraction.get("legal_terms", {}).get("indemnification"),
                liability_cap=extraction.get("legal_terms", {}).get("liability_cap"),
                insurance_requirements=extraction.get("legal_terms", {}).get("insurance_requirements"),
                service_levels=extraction.get("service_levels", {}),
                deliverables=extraction.get("deliverables", []),
                risk_score=extraction.get("risk_score", 0.0),
                risk_factors=extraction.get("risk_factors", []),
                clauses=extraction.get("clauses", {}),
                key_fields=extraction.get("key_fields", {}),
                extracted_metadata=extraction.get("metadata", {}),
                confidence_score=extraction.get("confidence_score", 0.0),
                version=version,
                previous_version_id=previous_contract.id if previous_contract else None,
                change_summary=f"Amendment detected with {len(extraction.get('clauses', {}))} clauses" if is_amendment else "Initial extraction"
            )
            
            local_db.add(contract)
            local_db.commit()
            local_db.refresh(contract)
            
            print(f"Contract saved with ID: {contract.id}, Version: {version}")
            
            # Create embeddings for RAG
            print(f"Creating embeddings for contract {contract.id}")
            rag = RAGEngine()
            embeddings = rag.create_embeddings(text)
            
            for emb in embeddings:
                rag_entry = models.RAGEmbedding(
                    contract_id=contract.id,
                    text_chunk=emb["text_chunk"],
                    embedding=emb["embedding"],
                    chunk_metadata=emb["metadata"],
                    version=version
                )
                local_db.add(rag_entry)
            
            local_db.commit()
            
            # Update document status
            document.status = "completed"
            document.version = version
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