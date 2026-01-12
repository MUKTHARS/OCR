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
from .agents.enhanced_rag_engine import EnhancedRAGEngine
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

def process_document_async(document_id: int, file_content: bytes, db: Session, 
                          is_amendment: bool = False, parent_document_id: Optional[int] = None):
    """Enhanced async processing with table extraction"""
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
            
            # Initialize processors
            print(f"Initializing processors for document {document_id}")
            processor = ContractProcessor()
            
            # Process contract with enhanced extraction
            print(f"Processing contract with table extraction")
            extraction = processor.process_contract(file_content, {
                "document_id": document_id,
                "filename": document.filename,
                "is_amendment": is_amendment
            })
            
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
            
            # Extract text for embeddings
            text_result = processor.extract_text_from_pdf(file_content)
            plain_text = text_result.get("text", "")
            
            # Fix the signatories extraction
            signatories_list = []
            contacts_list = []
            
            # Extract from multiple possible locations
            if extraction.get("contact_information"):
                if extraction["contact_information"].get("signatories"):
                    signatories_list = extraction["contact_information"]["signatories"]
                if extraction["contact_information"].get("administrative_contacts"):
                    contacts_list = extraction["contact_information"]["administrative_contacts"]
            
            if extraction.get("signatories"):
                signatories_list = extraction["signatories"]
            
            if extraction.get("contacts"):
                contacts_list = extraction["contacts"]
            
            # Helper function to extract risk factors
            def extract_risk_factors(extraction_data):
                """Extract risk factors from the extraction result"""
                risk_factors = []
                
                # Check for high risk indicators
                risk_indicators = extraction_data.get("risk_indicators", {})
                
                if risk_indicators.get("auto_renewal"):
                    risk_factors.append({
                        "factor": "Auto Renewal",
                        "severity": "medium",
                        "mitigation": "Set calendar reminder before renewal period",
                        "confidence": 0.9
                    })
                
                if risk_indicators.get("unlimited_liability"):
                    risk_factors.append({
                        "factor": "Unlimited Liability",
                        "severity": "high",
                        "mitigation": "Negotiate liability cap",
                        "confidence": 0.8
                    })
                
                # Add risk based on contract value
                financial = extraction_data.get("financial", {})
                if financial.get("total_value", 0) > 1000000:
                    risk_factors.append({
                        "factor": "High Contract Value",
                        "severity": "high" if financial.get("total_value", 0) > 5000000 else "medium",
                        "mitigation": "Additional review required",
                        "confidence": 1.0
                    })
                
                # Add risk based on expiration
                dates = extraction_data.get("dates", {})
                if dates.get("expiration_date"):
                    try:
                        exp_date = datetime.fromisoformat(dates["expiration_date"].replace('Z', '+00:00'))
                        days_remaining = (exp_date - datetime.now()).days
                        if days_remaining < 90:
                            risk_factors.append({
                                "factor": "Contract Expiring Soon",
                                "severity": "high" if days_remaining < 30 else "medium",
                                "mitigation": "Initiate renewal process",
                                "confidence": 1.0
                            })
                    except:
                        pass
                
                return risk_factors
            
            # Get risk factors
            risk_factors_list = extract_risk_factors(extraction)
            
            # Helper function to clean date values
            def clean_date(date_value):
                """Convert empty strings to None for date fields"""
                if not date_value or date_value == "" or date_value == "Unknown":
                    return None
                return date_value

            # Save contract with all extracted fields
            # Save contract with all extracted fields
            # Save contract with all extracted fields
            # contract_data = {
            #     "document_id": document_id,
            #     "contract_type": extraction.get("contract_type", "Unknown"),
            #     "contract_subtype": extraction.get("contract_subtype"),
            #     "master_agreement_id": extraction.get("master_agreement_id"),
            #     "parties": extraction.get("parties", []),
            #     "effective_date": clean_date(extraction.get("dates", {}).get("effective_date")),
            #     "expiration_date": clean_date(extraction.get("dates", {}).get("expiration_date")),
            #     "execution_date": clean_date(extraction.get("dates", {}).get("execution_date")),
            #     "termination_date": clean_date(extraction.get("dates", {}).get("termination_date")),
            #     "total_value": extraction.get("financial", {}).get("total_value"),
            #     "currency": extraction.get("financial", {}).get("currency"),
            #     "payment_terms": extraction.get("financial", {}).get("payment_terms"),
            #     "billing_frequency": extraction.get("financial", {}).get("billing_frequency"),
            #     "signatories": signatories_list,
            #     "contacts": contacts_list,
            #     "auto_renewal": extraction.get("risk_indicators", {}).get("auto_renewal"),
            #     "renewal_notice_period": extraction.get("dates", {}).get("notice_period_days"),
            #     "termination_notice_period": extraction.get("dates", {}).get("notice_period_days"),
            #     "governing_law": extraction.get("key_fields", {}).get("governing_law", {}).get("value") if extraction.get("key_fields", {}).get("governing_law") else None,
            #     "jurisdiction": extraction.get("key_fields", {}).get("governing_law", {}).get("value") if extraction.get("key_fields", {}).get("governing_law") else None,
            #     "confidentiality": extraction.get("clauses", {}).get("confidentiality") is not None,
            #     "indemnification": extraction.get("clauses", {}).get("indemnification") is not None,
            #     "liability_cap": extraction.get("key_fields", {}).get("liability_cap", {}).get("value") if extraction.get("key_fields", {}).get("liability_cap") else None,
            #     "insurance_requirements": extraction.get("compliance_requirements", {}).get("minimum_coverage"),
            #     "service_levels": extraction.get("service_levels", {}),
            #     "deliverables": extraction.get("deliverables", []),
            #     "risk_score": extraction.get("risk_score", 0.0),
            #     "risk_factors": risk_factors_list,
            #     "clauses": extraction.get("clauses", {}),
            #     "key_fields": extraction.get("key_fields", {}),
            #     "extracted_metadata": extraction.get("metadata", {}),
            #     "confidence_score": extraction.get("confidence_score", 0.0),
            #     "version": version,
            #     "previous_version_id": previous_contract.id if previous_contract else None,
            #     "change_summary": f"Amendment detected with {len(extraction.get('clauses', {}))} clauses" if is_amendment else "Initial extraction",
            #     "needs_review": True,
            # }

            # # Create contract without extracted_tables_data field
            # contract = models.Contract(**contract_data)

            # local_db.add(contract)
            # local_db.commit()
            # local_db.refresh(contract)

            # print(f"Contract saved with ID: {contract.id}, Version: {version}")

            contract_data = {
                "document_id": document_id,
                "contract_type": extraction.get("contract_type", "Unknown"),
                "contract_subtype": extraction.get("contract_subtype"),
                "master_agreement_id": extraction.get("master_agreement_id"),
                "parties": extraction.get("parties", []),
                "effective_date": clean_date(extraction.get("dates", {}).get("effective_date")),
                "expiration_date": clean_date(extraction.get("dates", {}).get("expiration_date")),
                "execution_date": clean_date(extraction.get("dates", {}).get("execution_date")),
                "termination_date": clean_date(extraction.get("dates", {}).get("termination_date")),
                "total_value": extraction.get("financial", {}).get("total_value"),
                "currency": extraction.get("financial", {}).get("currency"),
                "payment_terms": extraction.get("financial", {}).get("payment_terms"),
                "billing_frequency": extraction.get("financial", {}).get("billing_frequency"),
                "signatories": signatories_list,
                "contacts": contacts_list,
                "auto_renewal": extraction.get("risk_indicators", {}).get("auto_renewal"),
                "renewal_notice_period": extraction.get("dates", {}).get("notice_period_days"),
                "termination_notice_period": extraction.get("dates", {}).get("notice_period_days"),
                "governing_law": extraction.get("key_fields", {}).get("governing_law", {}).get("value") if extraction.get("key_fields", {}).get("governing_law") else None,
                "jurisdiction": extraction.get("key_fields", {}).get("governing_law", {}).get("value") if extraction.get("key_fields", {}).get("governing_law") else None,
                "confidentiality": extraction.get("clauses", {}).get("confidentiality") is not None,
                "indemnification": extraction.get("clauses", {}).get("indemnification") is not None,
                "liability_cap": extraction.get("key_fields", {}).get("liability_cap", {}).get("value") if extraction.get("key_fields", {}).get("liability_cap") else None,
                "insurance_requirements": extraction.get("compliance_requirements", {}).get("minimum_coverage"),
                "service_levels": extraction.get("service_levels", {}),
                "deliverables": extraction.get("deliverables", []),
                "risk_score": extraction.get("risk_score", 0.0),
                "risk_factors": risk_factors_list,
                "clauses": extraction.get("clauses", {}),
                "key_fields": extraction.get("key_fields", {}),
                "extracted_metadata": extraction.get("metadata", {}),
                "extracted_tables_data": extraction.get("extracted_tables", {}),  # Add this line
                "confidence_score": extraction.get("confidence_score", 0.0),
                "version": version,
                "previous_version_id": previous_contract.id if previous_contract else None,
                "change_summary": f"Amendment detected with {len(extraction.get('clauses', {}))} clauses" if is_amendment else "Initial extraction",
                "needs_review": True,
            }

            # Create contract
            contract = models.Contract(**contract_data)
            local_db.add(contract)
            local_db.commit()
            local_db.refresh(contract)

            print(f"Contract saved with ID: {contract.id}, Version: {version}")
            print(f"Extracted tables count: {len(extraction.get('extracted_tables', {}).get('tables', [])) if extraction.get('extracted_tables') else 0}")

            # Store extracted tables in a separate field if it exists
            try:
                if hasattr(contract, 'extracted_tables_data'):
                    contract.extracted_tables_data = extraction.get("extracted_tables", {})
                    local_db.commit()
                    print(f"Extracted tables data stored for contract {contract.id}")
            except Exception as e:
                print(f"Note: Could not store extracted tables data: {e}")
            
            # Create embeddings for RAG using EnhancedRAGEngine
            print(f"Creating embeddings for contract {contract.id} using ChromaDB")
            if plain_text:
                enhanced_rag = EnhancedRAGEngine()
                embeddings = enhanced_rag.create_embeddings(plain_text, contract.id, version)
                print(f"Created {len(embeddings)} embeddings in ChromaDB")
                
                # Store minimal reference in PostgreSQL
                for emb in embeddings:
                    rag_emb = models.RAGEmbedding(
                        contract_id=contract.id,
                        text_chunk=emb["text_chunk"],
                        embedding={},  # Empty since we're using ChromaDB
                        chunk_metadata=emb["chunk_metadata"],
                        chroma_chunk_id=emb.get("chunk_id"),
                        vector_db_type="chromadb",
                        version=version
                    )
                    local_db.add(rag_emb)
                
                local_db.commit()
                print(f"Saved {len(embeddings)} embedding references to PostgreSQL")
            else:
                print("No text available for embeddings")
            
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
                    document.last_processing_error = str(e)
                    document.processing_attempts = (document.processing_attempts or 0) + 1
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
        text_result = processor.extract_text_from_pdf(contents)
        plain_text = text_result.get("text", "")

        if not plain_text or len(plain_text.strip()) < 50:
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


@app.post("/contracts/compare")
async def compare_contracts(
    compare_request: schemas.ContractCompareRequest,
    db: Session = Depends(get_db)
):
    """Compare two contracts for differences"""
    try:
        # Get both contracts
        contract1 = db.query(models.Contract)\
            .filter(models.Contract.id == compare_request.contract_id_1)\
            .first()
        contract2 = db.query(models.Contract)\
            .filter(models.Contract.id == compare_request.contract_id_2)\
            .first()
        
        if not contract1 or not contract2:
            raise HTTPException(status_code=404, detail="One or both contracts not found")
        
        # Prepare extraction data for comparison
        extraction1 = {
            "contract_type": contract1.contract_type,
            "contract_subtype": contract1.contract_subtype,
            "master_agreement_id": contract1.master_agreement_id,
            "parties": contract1.parties,
            "dates": {
                "effective_date": contract1.effective_date,
                "expiration_date": contract1.expiration_date,
                "execution_date": contract1.execution_date,
                "termination_date": contract1.termination_date,
            },
            "financial": {
                "total_value": contract1.total_value,
                "currency": contract1.currency,
                "payment_terms": contract1.payment_terms,
                "billing_frequency": contract1.billing_frequency,
            },
            "clauses": contract1.clauses or {},
            "key_fields": contract1.key_fields or {},
            "confidence_score": contract1.confidence_score,
        }
        
        extraction2 = {
            "contract_type": contract2.contract_type,
            "contract_subtype": contract2.contract_subtype,
            "master_agreement_id": contract2.master_agreement_id,
            "parties": contract2.parties,
            "dates": {
                "effective_date": contract2.effective_date,
                "expiration_date": contract2.expiration_date,
                "execution_date": contract2.execution_date,
                "termination_date": contract2.termination_date,
            },
            "financial": {
                "total_value": contract2.total_value,
                "currency": contract2.currency,
                "payment_terms": contract2.payment_terms,
                "billing_frequency": contract2.billing_frequency,
            },
            "clauses": contract2.clauses or {},
            "key_fields": contract2.key_fields or {},
            "confidence_score": contract2.confidence_score,
        }
        
        # Use the processor to compare
        comparison = processor.compare_versions(extraction1, extraction2)
        
        # Generate AI-powered comparison summary
        comparison_summary = generate_comparison_summary(
            contract1, 
            contract2, 
            comparison.get("deltas", [])
        )
        
        return {
            "contract1": {
                "id": contract1.id,
                "contract_type": contract1.contract_type,
                "parties": contract1.parties,
                "version": contract1.version
            },
            "contract2": {
                "id": contract2.id,
                "contract_type": contract2.contract_type,
                "parties": contract2.parties,
                "version": contract2.version
            },
            "comparison": comparison,
            "summary": comparison_summary,
            "suggested_actions": generate_suggested_actions(comparison)
        }
        
    except Exception as e:
        print(f"Error comparing contracts: {e}")
        raise HTTPException(status_code=500, detail=str(e))

def generate_comparison_summary(contract1, contract2, deltas):
    """Generate detailed comparison summary"""
    if not deltas:
        return "No changes detected between the two versions."
    
    # Group changes by category
    changes_by_category = {
        "financial": [],
        "legal": [],
        "dates": [],
        "parties": [],
        "clauses": [],
        "other": []
    }
    
    for delta in deltas:
        field_name = delta["field_name"].lower()
        
        if any(term in field_name for term in ["financial", "payment", "value", "amount", "currency"]):
            changes_by_category["financial"].append(delta)
        elif any(term in field_name for term in ["clause", "legal", "liability", "indemn", "confidential"]):
            changes_by_category["legal"].append(delta)
        elif "date" in field_name:
            changes_by_category["dates"].append(delta)
        elif any(term in field_name for term in ["party", "signatory", "contact"]):
            changes_by_category["parties"].append(delta)
        elif "clause" in field_name:
            changes_by_category["clauses"].append(delta)
        else:
            changes_by_category["other"].append(delta)
    
    # Build summary
    summary_parts = []
    
    for category, changes in changes_by_category.items():
        if changes:
            count = len(changes)
            added = sum(1 for c in changes if c.get("change_type") == "added")
            removed = sum(1 for c in changes if c.get("change_type") == "removed")
            modified = sum(1 for c in changes if c.get("change_type") == "modified")
            
            category_summary = f"{count} {category} changes"
            if added or removed or modified:
                details = []
                if added: details.append(f"{added} added")
                if removed: details.append(f"{removed} removed")
                if modified: details.append(f"{modified} modified")
                category_summary += f" ({', '.join(details)})"
            
            summary_parts.append(category_summary)
    
    if summary_parts:
        return f"Amendment detected. Key changes: {', '.join(summary_parts)}."
    
    return "Minor changes detected."
    
def generate_suggested_actions(comparison):
    """Generate suggested actions based on comparison"""
    actions = []
    deltas = comparison.get("deltas", [])
    
    # Check for high-risk changes
    high_risk_terms = ["liability", "indemnification", "termination", "penalty", "renewal"]
    
    for delta in deltas:
        field_name = delta["field_name"].lower()
        if any(term in field_name for term in high_risk_terms):
            actions.append(f"Review {field_name} change - potential risk impact")
    
    # Check for financial changes
    financial_changes = [d for d in deltas if "financial" in d["field_name"].lower()]
    if financial_changes:
        actions.append("Consult finance team on monetary changes")
    
    if not actions:
        actions.append("No critical actions required")
    
    return actions

@app.get("/documents/{document_id}/status")
async def get_document_status(
    document_id: int,
    db: Session = Depends(get_db)
):
    """Get document processing status"""
    document = db.query(models.Document)\
        .filter(models.Document.id == document_id)\
        .first()
    
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Check if contract exists for this document
    contract = db.query(models.Contract)\
        .filter(models.Contract.document_id == document_id)\
        .first()
    
    return {
        "document_id": document.id,
        "status": document.status,
        "is_completed": document.status == "completed",
        "has_contract": contract is not None,
        "contract_id": contract.id if contract else None,
        "upload_date": document.upload_date
    }    

@app.get("/contracts/{contract_id}/tables")
async def get_contract_tables(
    contract_id: int,
    db: Session = Depends(get_db)
):
    """Get extracted tables for a contract"""
    contract = db.query(models.Contract)\
        .filter(models.Contract.id == contract_id)\
        .first()
    
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")
    
    return {
        "contract_id": contract_id,
        "tables_data": contract.extracted_tables_data or {},
        "has_tables": bool(contract.extracted_tables_data)
    }

@app.post("/contracts/rag/search")
async def rag_search(
    query: str,
    contract_ids: Optional[List[int]] = None,
    limit: int = 5,
    db: Session = Depends(get_db)
):
    """Search contracts using RAG with vector similarity"""
    try:
        enhanced_rag = EnhancedRAGEngine()
        
        # Perform similarity search
        similar_chunks = enhanced_rag.search_similar(query, contract_ids, limit)
        
        # Group by contract
        results_by_contract = {}
        for chunk in similar_chunks:
            contract_id = chunk["contract_id"]
            if contract_id not in results_by_contract:
                # Get contract info
                contract = db.query(models.Contract)\
                    .filter(models.Contract.id == contract_id)\
                    .first()
                
                if contract:
                    results_by_contract[contract_id] = {
                        "contract": {
                            "id": contract.id,
                            "contract_type": contract.contract_type,
                            "parties": contract.parties,
                            "total_value": contract.total_value
                        },
                        "chunks": [],
                        "max_similarity": 0
                    }
            
            if contract_id in results_by_contract:
                results_by_contract[contract_id]["chunks"].append({
                    "text": chunk["text_chunk"][:300] + "..." if len(chunk["text_chunk"]) > 300 else chunk["text_chunk"],
                    "similarity": chunk["similarity"]
                })
                results_by_contract[contract_id]["max_similarity"] = max(
                    results_by_contract[contract_id]["max_similarity"],
                    chunk["similarity"]
                )
        
        # Sort by similarity
        results = sorted(
            results_by_contract.values(),
            key=lambda x: x["max_similarity"],
            reverse=True
        )
        
        return {
            "query": query,
            "results": results,
            "total_results": len(results)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/contracts/{contract_id}/summary/ai")
async def get_ai_contract_summary(
    contract_id: int,
    db: Session = Depends(get_db)
):
    """Get AI-generated summary of contract"""
    try:
        enhanced_rag = EnhancedRAGEngine()
        summary = enhanced_rag.get_contract_summary(contract_id)
        
        if "error" in summary:
            raise HTTPException(status_code=404, detail=summary["error"])
        
        return summary
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))