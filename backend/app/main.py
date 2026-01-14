from fastapi import FastAPI, UploadFile, File, HTTPException, Depends, Form
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Dict, Any
import os
from pathlib import Path
from dotenv import load_dotenv
from app.database import SessionLocal
from datetime import datetime
import math
import json
from typing import Optional

# Load .env file from the project root
env_path = Path("C:/saple.ai/OCR/backend/.env")
if env_path.exists():
    print(f"Loading .env file from: {env_path}")
    load_dotenv(dotenv_path=env_path, override=True)
else:
    # Try alternative path
    env_path = Path(".env")
    if env_path.exists():
        print(f"Loading .env file from: {env_path}")
        load_dotenv(dotenv_path=env_path, override=True)
    else:
        print("Warning: .env file not found. Using system environment variables.")

# Now load other imports
from app.database import get_db, engine
from . import models
from . import schemas
from .agents.contract_processor import ContractProcessor
from .agents.rag_engine import RAGEngine
from .agents.enhanced_rag_engine import EnhancedRAGEngine

# Debug: Check if OPENAI_API_KEY is loaded
api_key = os.getenv("OPENAI_API_KEY")
if api_key:
    print(f"OPENAI_API_KEY loaded: {api_key[:10]}...{api_key[-4:] if len(api_key) > 14 else '***'}")
else:
    print("Warning: OPENAI_API_KEY not found in environment")

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

# Helper function to clean JSON for database
def clean_json_for_db(data):
    """Clean JSON data by converting NaN to null"""
    import math
    import json
    
    def _clean_value(value):
        if isinstance(value, float):
            if math.isnan(value):
                return None
            elif math.isinf(value):
                return None
            return value
        elif isinstance(value, dict):
            return {k: _clean_value(v) for k, v in value.items()}
        elif isinstance(value, list):
            return [_clean_value(item) for item in value]
        elif value is None:
            return None
        else:
            # Handle string representations
            if isinstance(value, str):
                if value.lower() in ['nan', 'inf', '-inf', 'infinity', '-infinity']:
                    return None
            return value
    
    if isinstance(data, str):
        try:
            # Parse and clean
            parsed = json.loads(data)
            cleaned = _clean_value(parsed)
            return json.dumps(cleaned, ensure_ascii=False)
        except:
            # If not valid JSON, clean string directly
            cleaned_str = data.replace(': NaN', ': null').replace(': nan', ': null')
            cleaned_str = cleaned_str.replace('"NaN"', 'null').replace('"nan"', 'null')
            return cleaned_str
    else:
        # Already a Python object
        cleaned = _clean_value(data)
        return json.dumps(cleaned, ensure_ascii=False) if cleaned is not None else None

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
            
            # FIXED: Use process_contract instead of process_contract_text
            print(f"Processing contract with table extraction")
            extraction = processor.process_contract(file_content, {  # Changed to process_contract
                "document_id": document_id,
                "filename": document.filename,
                "is_amendment": is_amendment,
                "parent_document_id": parent_document_id
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
            
            # Fix the signatories extraction - check all possible locations
            signatories_list = []
            contacts_list = []
            clauses_dict = {}
            
            # Extract signatories from multiple possible locations
            # Priority: contact_information.signatories > signatories > contacts
            if extraction.get("contact_information"):
                if extraction["contact_information"].get("signatories"):
                    signatories_list = extraction["contact_information"]["signatories"]
                if extraction["contact_information"].get("administrative_contacts"):
                    contacts_list = extraction["contact_information"]["administrative_contacts"]
            
            if not signatories_list and extraction.get("signatories"):
                signatories_list = extraction["signatories"]
            
            if not contacts_list and extraction.get("contacts"):
                contacts_list = extraction["contacts"]
            
            # Extract clauses - ensure it's not empty dict or string
            if extraction.get("clauses"):
                clauses_dict = extraction["clauses"]
            # If clauses is empty or not found, try to extract from key_fields
            if not clauses_dict or clauses_dict == {}:
                # Look for clause information in key_fields or other sections
                key_fields = extraction.get("key_fields", {})
                if key_fields:
                    # Build clauses from key_fields that represent clauses
                    clause_keywords = ["confidentiality", "indemnification", "liability", "termination", "renewal", "termination_clause"]
                    for field_name, field_data in key_fields.items():
                        if any(keyword in field_name.lower() for keyword in clause_keywords):
                            if isinstance(field_data, dict):
                                clauses_dict[field_name] = field_data
                            else:
                                clauses_dict[field_name] = {"text": str(field_data), "category": field_name}
            
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

            # Clean all JSON fields before saving
            deliverables_cleaned = clean_json_for_db(extraction.get("deliverables", []))
            extracted_tables_cleaned = clean_json_for_db(extraction.get("extracted_tables", {}))
            clauses_cleaned = clean_json_for_db(clauses_dict if clauses_dict else {})
            key_fields_cleaned = clean_json_for_db(extraction.get("key_fields", {}))
            metadata_cleaned = clean_json_for_db(extraction.get("metadata", {}))
            risk_factors_cleaned = clean_json_for_db(risk_factors_list)
            signatories_cleaned = clean_json_for_db(signatories_list)
            contacts_cleaned = clean_json_for_db(contacts_list)
            parties_cleaned = clean_json_for_db(extraction.get("parties", []))
            service_levels_cleaned = clean_json_for_db(extraction.get("service_levels", {}))

            contract_data = {
                "document_id": document_id,
                "contract_type": extraction.get("contract_type", "Unknown"),
                "contract_subtype": extraction.get("contract_subtype"),
                "master_agreement_id": extraction.get("master_agreement_id"),
                "parties": parties_cleaned,
                "effective_date": clean_date(extraction.get("dates", {}).get("effective_date")),
                "expiration_date": clean_date(extraction.get("dates", {}).get("expiration_date")),
                "execution_date": clean_date(extraction.get("dates", {}).get("execution_date")),
                "termination_date": clean_date(extraction.get("dates", {}).get("termination_date")),
                "total_value": extraction.get("financial", {}).get("total_value"),
                "currency": extraction.get("financial", {}).get("currency"),
                "payment_terms": extraction.get("financial", {}).get("payment_terms"),
                "billing_frequency": extraction.get("financial", {}).get("billing_frequency"),
                "signatories": signatories_cleaned,
                "contacts": contacts_cleaned,
                "auto_renewal": extraction.get("risk_indicators", {}).get("auto_renewal"),
                "renewal_notice_period": extraction.get("dates", {}).get("notice_period_days"),
                "termination_notice_period": extraction.get("dates", {}).get("notice_period_days"),
                "governing_law": extraction.get("key_fields", {}).get("governing_law", {}).get("value") if extraction.get("key_fields", {}).get("governing_law") else None,
                "jurisdiction": extraction.get("key_fields", {}).get("governing_law", {}).get("value") if extraction.get("key_fields", {}).get("governing_law") else None,
                "confidentiality": extraction.get("clauses", {}).get("confidentiality") is not None,
                "indemnification": extraction.get("clauses", {}).get("indemnification") is not None,
                "liability_cap": extraction.get("key_fields", {}).get("liability_cap", {}).get("value") if extraction.get("key_fields", {}).get("liability_cap") else None,
                "insurance_requirements": extraction.get("compliance_requirements", {}).get("minimum_coverage"),
                "service_levels": service_levels_cleaned,
                "deliverables": deliverables_cleaned,
                "risk_score": extraction.get("risk_score", 0.0),
                "risk_factors": risk_factors_cleaned,
                "clauses": clauses_cleaned,
                "key_fields": key_fields_cleaned,
                "extracted_metadata": metadata_cleaned,
                "extracted_tables_data": extracted_tables_cleaned,
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
    from sqlalchemy import or_, and_, String
    
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
    
    # Ensure all fields are properly serialized
    contract_list = []
    for contract in contracts:
        contract_dict = contract.__dict__.copy()
        
        # Helper function to parse JSON strings
        def parse_json_field(field_value, field_name=''):
            if isinstance(field_value, str):
                # Handle empty strings
                if field_value.strip() == '':
                    # Return appropriate empty type based on field name
                    if field_name in ['signatories', 'contacts', 'risk_factors', 'deliverables', 'parties']:
                        return []
                    else:  # clauses, key_fields, extracted_metadata, service_levels, extracted_tables_data
                        return {}
                
                try:
                    return json.loads(field_value)
                except:
                    # If it looks like an empty dict/list string, return appropriate type
                    if field_value == '{}':
                        return {}
                    elif field_value == '[]':
                        return []
                    # Try to handle malformed JSON
                    cleaned = field_value.strip()
                    if cleaned.startswith('{') and cleaned.endswith('}'):
                        try:
                            # Try to fix common issues
                            fixed = cleaned.replace("'", '"').replace('None', 'null').replace('True', 'true').replace('False', 'false')
                            return json.loads(fixed)
                        except:
                            return {}
                    elif cleaned.startswith('[') and cleaned.endswith(']'):
                        try:
                            fixed = cleaned.replace("'", '"').replace('None', 'null').replace('True', 'true').replace('False', 'false')
                            return json.loads(fixed)
                        except:
                            return []
                    # If it's a non-empty string that doesn't look like JSON
                    if field_name in ['signatories', 'contacts', 'risk_factors', 'deliverables', 'parties']:
                        return []
                    else:
                        return {}
            elif field_value is None:
                # Return appropriate empty type based on field name
                if field_name in ['signatories', 'contacts', 'risk_factors', 'deliverables', 'parties']:
                    return []
                else:
                    return {}
            return field_value
        
        # Parse all JSON fields
        json_fields = [
            'parties', 'signatories', 'contacts', 'deliverables', 
            'risk_factors', 'clauses', 'key_fields', 'extracted_metadata',
            'service_levels', 'extracted_tables_data'
        ]
        
        for field in json_fields:
            if field in contract_dict:
                contract_dict[field] = parse_json_field(contract_dict[field], field)
        
        # SPECIAL FIX: Handle deliverables that are strings instead of dictionaries
        if contract_dict.get('deliverables') and isinstance(contract_dict['deliverables'], list):
            fixed_deliverables = []
            for item in contract_dict['deliverables']:
                if isinstance(item, str):
                    # Convert string to dictionary format
                    fixed_deliverables.append({
                        "description": item,
                        "due_date": None,  # Extract date from string if possible
                        "status": "pending"
                    })
                elif isinstance(item, dict):
                    # Already a dictionary, keep as is
                    fixed_deliverables.append(item)
                else:
                    # Other types, convert to string
                    fixed_deliverables.append({
                        "description": str(item),
                        "due_date": None,
                        "status": "pending"
                    })
            contract_dict['deliverables'] = fixed_deliverables
        
        # Ensure specific field types
        if contract_dict.get('service_levels') is None:
            contract_dict['service_levels'] = {}
        if contract_dict.get('clauses') is None:
            contract_dict['clauses'] = {}
        if contract_dict.get('key_fields') is None:
            contract_dict['key_fields'] = {}
        if contract_dict.get('extracted_metadata') is None:
            contract_dict['extracted_metadata'] = {}
        if contract_dict.get('deliverables') is None:
            contract_dict['deliverables'] = []
        if contract_dict.get('risk_factors') is None:
            contract_dict['risk_factors'] = []
        if contract_dict.get('parties') is None:
            contract_dict['parties'] = []
        if contract_dict.get('signatories') is None:
            contract_dict['signatories'] = []
        if contract_dict.get('contacts') is None:
            contract_dict['contacts'] = []
        if contract_dict.get('extracted_tables_data') is None:
            contract_dict['extracted_tables_data'] = {}
        
        # Convert dates to ISO format
        for date_field in ['effective_date', 'expiration_date', 'execution_date', 'termination_date']:
            if contract_dict.get(date_field) and hasattr(contract_dict[date_field], 'isoformat'):
                contract_dict[date_field] = contract_dict[date_field].isoformat()
        
        # Add risk_level based on risk_score
        risk_score = contract_dict.get('risk_score', 0.0)
        if risk_score >= 0.7:
            contract_dict['risk_level'] = "high"
        elif risk_score >= 0.3:
            contract_dict['risk_level'] = "medium"
        else:
            contract_dict['risk_level'] = "low"
        
        # Add amendment_count
        amendment_count = db.query(models.ContractAmendment).filter(
            models.ContractAmendment.parent_contract_id == contract.id
        ).count()
        contract_dict['amendment_count'] = amendment_count
        
        contract_list.append(contract_dict)
    
    return contract_list 

# @app.get("/contracts", response_model=List[schemas.ContractResponse])
# async def get_contracts(
#     skip: int = 0,
#     limit: int = 100,
#     db: Session = Depends(get_db)
# ):
#     """Get all contracts"""
#     contracts = db.query(models.Contract)\
#         .offset(skip)\
#         .limit(limit)\
#         .all()
    
#     # Ensure all fields are properly serialized
#     contract_list = []
#     for contract in contracts:
#         contract_dict = contract.__dict__.copy()
        
#         # Ensure signatories and contacts are properly formatted
#         if isinstance(contract_dict.get('signatories'), str):
#             try:
#                 contract_dict['signatories'] = json.loads(contract_dict['signatories'])
#             except:
#                 contract_dict['signatories'] = []
        
#         if isinstance(contract_dict.get('contacts'), str):
#             try:
#                 contract_dict['contacts'] = json.loads(contract_dict['contacts'])
#             except:
#                 contract_dict['contacts'] = []
        
#         # Ensure parties is a list
#         if isinstance(contract_dict.get('parties'), str):
#             try:
#                 contract_dict['parties'] = json.loads(contract_dict['parties'])
#             except:
#                 contract_dict['parties'] = []
#         elif contract_dict.get('parties') is None:
#             contract_dict['parties'] = []
        
#         # Convert dates to ISO format
#         for date_field in ['effective_date', 'expiration_date', 'execution_date', 'termination_date']:
#             if contract_dict.get(date_field) and hasattr(contract_dict[date_field], 'isoformat'):
#                 contract_dict[date_field] = contract_dict[date_field].isoformat()
        
#         contract_list.append(contract_dict)
    
#     return contract_list

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
    
    # Convert the contract to a dictionary and parse JSON strings
    contract_dict = contract.__dict__.copy()
    
    # Helper function to parse JSON strings
    def parse_json_field(field_value, field_name=''):
        if isinstance(field_value, str):
            # Handle empty strings
            if field_value.strip() == '':
                # Return appropriate empty type based on field name
                if field_name in ['signatories', 'contacts', 'risk_factors', 'deliverables', 'parties']:
                    return []
                else:  # clauses, key_fields, extracted_metadata, service_levels, extracted_tables_data
                    return {}
            
            try:
                return json.loads(field_value)
            except:
                # If it looks like an empty dict/list string, return appropriate type
                if field_value == '{}':
                    return {}
                elif field_value == '[]':
                    return []
                # Try to handle malformed JSON
                cleaned = field_value.strip()
                if cleaned.startswith('{') and cleaned.endswith('}'):
                    try:
                        # Try to fix common issues
                        fixed = cleaned.replace("'", '"').replace('None', 'null').replace('True', 'true').replace('False', 'false')
                        return json.loads(fixed)
                    except:
                        return {}
                elif cleaned.startswith('[') and cleaned.endswith(']'):
                    try:
                        fixed = cleaned.replace("'", '"').replace('None', 'null').replace('True', 'true').replace('False', 'false')
                        return json.loads(fixed)
                    except:
                        return []
                # If it's a non-empty string that doesn't look like JSON
                if field_name in ['signatories', 'contacts', 'risk_factors', 'deliverables', 'parties']:
                    return []
                else:
                    return {}
        elif field_value is None:
            # Return appropriate empty type based on field name
            if field_name in ['signatories', 'contacts', 'risk_factors', 'deliverables', 'parties']:
                return []
            else:
                return {}
        return field_value
    
    # Parse all JSON fields
    json_fields = [
        'parties', 'signatories', 'contacts', 'deliverables', 
        'risk_factors', 'clauses', 'key_fields', 'extracted_metadata',
        'service_levels', 'extracted_tables_data'
    ]
    
    for field in json_fields:
        if field in contract_dict:
            contract_dict[field] = parse_json_field(contract_dict[field], field)
    
    # SPECIAL FIX: Handle deliverables that are strings instead of dictionaries
    if contract_dict.get('deliverables') and isinstance(contract_dict['deliverables'], list):
        fixed_deliverables = []
        for item in contract_dict['deliverables']:
            if isinstance(item, str):
                # Convert string to dictionary format
                fixed_deliverables.append({
                    "description": item,
                    "due_date": None,  # Extract date from string if possible
                    "status": "pending"
                })
            elif isinstance(item, dict):
                # Already a dictionary, keep as is
                fixed_deliverables.append(item)
            else:
                # Other types, convert to string
                fixed_deliverables.append({
                    "description": str(item),
                    "due_date": None,
                    "status": "pending"
                })
        contract_dict['deliverables'] = fixed_deliverables
    
    # Ensure specific field types
    if contract_dict.get('service_levels') is None:
        contract_dict['service_levels'] = {}
    if contract_dict.get('clauses') is None:
        contract_dict['clauses'] = {}
    if contract_dict.get('key_fields') is None:
        contract_dict['key_fields'] = {}
    if contract_dict.get('extracted_metadata') is None:
        contract_dict['extracted_metadata'] = {}
    if contract_dict.get('deliverables') is None:
        contract_dict['deliverables'] = []
    if contract_dict.get('risk_factors') is None:
        contract_dict['risk_factors'] = []
    if contract_dict.get('parties') is None:
        contract_dict['parties'] = []
    if contract_dict.get('signatories') is None:
        contract_dict['signatories'] = []
    if contract_dict.get('contacts') is None:
        contract_dict['contacts'] = []
    if contract_dict.get('extracted_tables_data') is None:
        contract_dict['extracted_tables_data'] = {}
    
    # Convert dates to ISO format
    for date_field in ['effective_date', 'expiration_date', 'execution_date', 'termination_date']:
        if contract_dict.get(date_field) and hasattr(contract_dict[date_field], 'isoformat'):
            contract_dict[date_field] = contract_dict[date_field].isoformat()
    
    # Add the risk_level field based on risk_score
    risk_score = contract_dict.get('risk_score', 0.0)
    if risk_score >= 0.7:
        contract_dict['risk_level'] = "high"
    elif risk_score >= 0.3:
        contract_dict['risk_level'] = "medium"
    else:
        contract_dict['risk_level'] = "low"
    
    # Add amendment_count (count how many amendments this contract has)
    amendment_count = db.query(models.ContractAmendment).filter(
        models.ContractAmendment.parent_contract_id == contract_id
    ).count()
    contract_dict['amendment_count'] = amendment_count
    
    return contract_dict

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

@app.post("/contracts/{contract_id}/apply-amendment", response_model=Dict[str, Any])
async def apply_amendment_to_contract(
    contract_id: int,
    amendment_id: int,
    db: Session = Depends(get_db)
):
    """
    Apply amendment changes to the parent contract
    """
    try:
        # Get parent contract
        parent_contract = db.query(models.Contract).filter(models.Contract.id == contract_id).first()
        if not parent_contract:
            raise HTTPException(status_code=404, detail="Parent contract not found")
        
        # Get amendment contract
        amendment = db.query(models.Contract).filter(models.Contract.id == amendment_id).first()
        if not amendment:
            raise HTTPException(status_code=404, detail="Amendment not found")
        
        # Get the amendment document
        amendment_doc = db.query(models.Document).filter(
            models.Document.id == amendment.document_id,
            models.Document.is_amendment == True
        ).first()
        
        if not amendment_doc or amendment_doc.parent_document_id is None:
            raise HTTPException(status_code=400, detail="Invalid amendment document")
        
        # Apply amendment changes to parent contract
        updated_contract = apply_contract_amendment(parent_contract, amendment)
        
        # Save the updated contract as a new version
        updated_contract.previous_version_id = parent_contract.id
        updated_contract.version = parent_contract.version + 1
        updated_contract.change_summary = f"Amended by amendment {amendment_id} ({amendment_doc.amendment_type})"
        updated_contract.extraction_date = datetime.now()
        
        db.add(updated_contract)
        db.commit()
        db.refresh(updated_contract)
        
        # Create relationship record
        from app.models import ContractAmendment
        amendment_rel = ContractAmendment(
            parent_contract_id=parent_contract.id,
            amendment_contract_id=amendment.id,
            applied_date=datetime.now(),
            changes_applied=json.dumps(updated_contract.change_summary)
        )
        db.add(amendment_rel)
        db.commit()
        
        return {
            "success": True,
            "message": f"Amendment applied successfully. New version: v{updated_contract.version}",
            "parent_contract_id": parent_contract.id,
            "amendment_id": amendment_id,
            "new_version_id": updated_contract.id,
            "changes": updated_contract.change_summary
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error applying amendment: {str(e)}")

def apply_contract_amendment(parent_contract: models.Contract, amendment: models.Contract) -> models.Contract:
    """
    Apply amendment changes to parent contract
    Returns a new Contract object with updated values
    """
    # Create a copy of parent contract
    updated_contract = models.Contract()
    
    # Copy all fields from parent (excluding auto-generated ones)
    excluded_fields = ['id', 'version', 'previous_version_id', 'extraction_date', 
                      'change_summary', 'last_updated', 'reviewed_by', 'review_date']
    
    for key, value in parent_contract.__dict__.items():
        if not key.startswith('_') and key not in excluded_fields:
            setattr(updated_contract, key, value)
    
    # Get amendment type
    amendment_type = amendment.document.amendment_type if amendment.document else 'modification'
    
    print(f"Applying {amendment_type} amendment to contract v{parent_contract.version}")
    
    # Update financial values
    if amendment.total_value is not None:
        if amendment_type in ['modification', 'correction']:
            # Direct replacement
            updated_contract.total_value = amendment.total_value
            print(f"  - Total value modified: {parent_contract.total_value} -> {amendment.total_value}")
        
        elif amendment_type == 'addendum':
            # Add to existing value
            old_value = parent_contract.total_value or 0
            amendment_value = amendment.total_value or 0
            updated_contract.total_value = old_value + amendment_value
            print(f"  - Total value added: {old_value} + {amendment_value} = {updated_contract.total_value}")
        
        elif amendment_type in ['extension', 'renewal']:
            # For extensions/renewals, update if different
            if amendment.total_value != parent_contract.total_value:
                updated_contract.total_value = amendment.total_value
                print(f"  - Total value updated for {amendment_type}: {parent_contract.total_value} -> {amendment.total_value}")
        
        elif amendment_type == 'termination':
            # For termination, set to 0 or reduced value
            if amendment.total_value == 0:
                updated_contract.total_value = 0
                print(f"  - Total value terminated: {parent_contract.total_value} -> 0")
            else:
                updated_contract.total_value = amendment.total_value
                print(f"  - Total value reduced: {parent_contract.total_value} -> {amendment.total_value}")
    
    # Update currency if provided
    if amendment.currency:
        if amendment.currency != parent_contract.currency:
            updated_contract.currency = amendment.currency
            print(f"  - Currency changed: {parent_contract.currency} -> {amendment.currency}")
    
    # Update dates
    if amendment.effective_date:
        if amendment.effective_date != parent_contract.effective_date:
            updated_contract.effective_date = amendment.effective_date
            print(f"  - Effective date updated: {parent_contract.effective_date} -> {amendment.effective_date}")
    
    if amendment.expiration_date:
        if amendment_type in ['extension', 'renewal']:
            # For extensions/renewals, update expiration date
            updated_contract.expiration_date = amendment.expiration_date
            print(f"  - Expiration date {amendment_type}: {parent_contract.expiration_date} -> {amendment.expiration_date}")
        elif amendment.expiration_date != parent_contract.expiration_date:
            updated_contract.expiration_date = amendment.expiration_date
            print(f"  - Expiration date updated: {parent_contract.expiration_date} -> {amendment.expiration_date}")
    
    if amendment.execution_date and amendment.execution_date != parent_contract.execution_date:
        updated_contract.execution_date = amendment.execution_date
    
    if amendment.termination_date:
        updated_contract.termination_date = amendment.termination_date
        print(f"  - Termination date set: {amendment.termination_date}")
    
    # Update payment terms
    if amendment.payment_terms and amendment.payment_terms != parent_contract.payment_terms:
        updated_contract.payment_terms = amendment.payment_terms
        print(f"  - Payment terms updated: {parent_contract.payment_terms} -> {amendment.payment_terms}")
    
    # Update billing frequency
    if amendment.billing_frequency and amendment.billing_frequency != parent_contract.billing_frequency:
        updated_contract.billing_frequency = amendment.billing_frequency
    
    # Update parties (append for addendum, replace for modification)
    if amendment.parties:
        if amendment_type == 'addendum':
            # Add new parties
            existing_parties = set(parent_contract.parties or [])
            new_parties = set(amendment.parties)
            updated_contract.parties = list(existing_parties.union(new_parties))
            
            added_parties = new_parties - existing_parties
            if added_parties:
                print(f"  - Added parties: {list(added_parties)}")
        else:
            # Replace parties
            if set(amendment.parties) != set(parent_contract.parties or []):
                updated_contract.parties = amendment.parties
                print(f"  - Parties updated")
    
    # Update clauses (merge)
    if amendment.clauses:
        parent_clauses = parent_contract.clauses or {}
        amendment_clauses = amendment.clauses or {}
        
        if amendment_type == 'addendum':
            # Add new clauses
            updated_contract.clauses = {**parent_clauses, **amendment_clauses}
            
            new_clauses = set(amendment_clauses.keys()) - set(parent_clauses.keys())
            if new_clauses:
                print(f"  - Added clauses: {list(new_clauses)}")
        else:
            # Update existing clauses
            updated_clauses = parent_clauses.copy()
            for clause_name, clause_value in amendment_clauses.items():
                if clause_name not in parent_clauses or parent_clauses[clause_name] != clause_value:
                    updated_clauses[clause_name] = clause_value
                    print(f"  - Clause '{clause_name}' updated")
            updated_contract.clauses = updated_clauses
    
    # Update key fields
    if amendment.key_fields:
        parent_fields = parent_contract.key_fields or {}
        amendment_fields = amendment.key_fields or {}
        
        if amendment_type == 'addendum':
            updated_contract.key_fields = {**parent_fields, **amendment_fields}
        else:
            updated_fields = parent_fields.copy()
            for field_name, field_value in amendment_fields.items():
                if field_name not in parent_fields or parent_fields[field_name] != field_value:
                    updated_fields[field_name] = field_value
            updated_contract.key_fields = updated_fields
    
    # Update signatories
    if amendment.signatories:
        if amendment_type == 'addendum':
            # Add new signatories
            existing_signatories = parent_contract.signatories or []
            updated_contract.signatories = existing_signatories + amendment.signatories
            print(f"  - Added {len(amendment.signatories)} signatories")
        else:
            # Replace signatories
            updated_contract.signatories = amendment.signatories
            print(f"  - Signatories updated")
    
    # Update auto-renewal
    if amendment.auto_renewal is not None and amendment.auto_renewal != parent_contract.auto_renewal:
        updated_contract.auto_renewal = amendment.auto_renewal
        print(f"  - Auto-renewal changed: {parent_contract.auto_renewal} -> {amendment.auto_renewal}")
    
    # Update termination notice period
    if amendment.termination_notice_period is not None and amendment.termination_notice_period != parent_contract.termination_notice_period:
        updated_contract.termination_notice_period = amendment.termination_notice_period
        print(f"  - Termination notice period: {parent_contract.termination_notice_period} -> {amendment.termination_notice_period}")
    
    # Update renewal notice period
    if amendment.renewal_notice_period is not None and amendment.renewal_notice_period != parent_contract.renewal_notice_period:
        updated_contract.renewal_notice_period = amendment.renewal_notice_period
    
    # Update extracted tables data
    if amendment.extracted_tables_data:
        parent_tables = parent_contract.extracted_tables_data or {"tables": []}
        amendment_tables = amendment.extracted_tables_data or {"tables": []}
        
        if amendment_type == 'addendum':
            # Append tables
            updated_tables = parent_tables.copy()
            if "tables" in updated_tables and "tables" in amendment_tables:
                updated_tables["tables"].extend(amendment_tables["tables"])
            updated_contract.extracted_tables_data = updated_tables
            print(f"  - Added {len(amendment_tables.get('tables', []))} tables")
        else:
            # Update tables
            updated_contract.extracted_tables_data = amendment_tables
            print(f"  - Tables updated")
    
    # Update contract type/subtype if changed
    if amendment.contract_type and amendment.contract_type != parent_contract.contract_type:
        updated_contract.contract_type = amendment.contract_type
    
    if amendment.contract_subtype and amendment.contract_subtype != parent_contract.contract_subtype:
        updated_contract.contract_subtype = amendment.contract_subtype
    
    # Update master agreement ID
    if amendment.master_agreement_id and amendment.master_agreement_id != parent_contract.master_agreement_id:
        updated_contract.master_agreement_id = amendment.master_agreement_id
    
    # Update needs_review flag (amendments should be reviewed)
    updated_contract.needs_review = True
    
    # Update confidence score (use the higher of the two)
    updated_contract.confidence_score = max(parent_contract.confidence_score or 0, amendment.confidence_score or 0)
    
    # Recalculate risk score based on updated values
    try:
        from app.agents.contract_processor import ContractProcessor
        processor = ContractProcessor()
        
        # Create a mock extraction dict for risk calculation
        extraction_dict = {
            "financial": {
                "total_value": updated_contract.total_value,
                "currency": updated_contract.currency
            },
            "dates": {
                "expiration_date": updated_contract.expiration_date.isoformat() if updated_contract.expiration_date else None
            },
            "risk_indicators": {
                "auto_renewal": updated_contract.auto_renewal
            }
        }
        
        updated_contract.risk_score = processor._calculate_enhanced_risk_score(extraction_dict)
    except:
        # Keep existing risk score if calculation fails
        updated_contract.risk_score = parent_contract.risk_score or 0.5
    
    print(f"Amendment application complete. New total value: {updated_contract.total_value}")
    return updated_contract
    
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


@app.get("/env-check")
async def environment_check():
    """Check if environment variables are loaded correctly"""
    env_vars = {
        "OPENAI_API_KEY": os.getenv("OPENAI_API_KEY", "NOT SET"),
        "DATABASE_URL": os.getenv("DATABASE_URL", "NOT SET"),
        "ALLOWED_ORIGINS": os.getenv("ALLOWED_ORIGINS", "NOT SET"),
    }
    
    # Check if keys are properly loaded
    api_key = env_vars["OPENAI_API_KEY"]
    api_key_status = "SET" if api_key != "NOT SET" and len(api_key) > 10 else "INVALID/NOT SET"
    
    return {
        "environment_variables": env_vars,
        "status": {
            "openai_api_key": api_key_status,
            "database_url": "SET" if env_vars["DATABASE_URL"] != "NOT SET" else "NOT SET",
            "server_running": True
        },
        "chromadb_working": True,  # ChromaDB is working based on your logs
        "notes": "ChromaDB is working (based on logs). OpenAI needs API key."
    }   

@app.get("/debug/contracts")
async def debug_contracts(db: Session = Depends(get_db)):
    """Debug endpoint to check contract data"""
    from sqlalchemy import inspect
    
    contracts = db.query(models.Contract).all()
    
    result = []
    for contract in contracts:
        inspector = inspect(contract)
        
        # Get all column values
        contract_data = {}
        for column in inspector.mapper.columns:
            value = getattr(contract, column.key)
            contract_data[column.key] = {
                'value': value,
                'type': type(value).__name__,
                'is_json': isinstance(value, (dict, list))
            }
        
        result.append({
            'id': contract.id,
            'contract_type': contract.contract_type,
            'parties': contract.parties,
            'total_value': contract.total_value,
            'signatories': contract.signatories,
            'all_fields': contract_data
        })
    
    return {
        'total_contracts': len(contracts),
        'contracts': result
    }

@app.get("/debug/contract/{contract_id}")
async def debug_contract(contract_id: int, db: Session = Depends(get_db)):
    """Debug endpoint to check specific contract"""
    contract = db.query(models.Contract).filter(models.Contract.id == contract_id).first()
    
    if not contract:
        return {"error": f"Contract {contract_id} not found"}
    
    # Convert to dict with all fields
    contract_dict = {}
    for column in contract.__table__.columns:
        value = getattr(contract, column.name)
        contract_dict[column.name] = {
            'value': value,
            'type': type(value).__name__,
            'is_json': isinstance(value, (dict, list))
        }
    
    # Check if it has extracted_tables_data
    has_tables = bool(contract.extracted_tables_data)
    tables_count = 0
    if has_tables:
        if isinstance(contract.extracted_tables_data, dict):
            tables_count = len(contract.extracted_tables_data.get('tables', []))
        elif isinstance(contract.extracted_tables_data, str):
            try:
                tables_data = json.loads(contract.extracted_tables_data)
                tables_count = len(tables_data.get('tables', []))
            except:
                tables_count = 0
    
    return {
        'contract_id': contract.id,
        'contract_type': contract.contract_type,
        'parties': contract.parties,
        'total_value': contract.total_value,
        'has_tables': has_tables,
        'tables_count': tables_count,
        'document_id': contract.document_id,
        'version': contract.version,
        'all_fields': contract_dict
    } 

@app.post("/documents/upload", response_model=schemas.DocumentResponse)
async def upload_document_with_metadata(
    file: UploadFile = File(...),
    metadata: str = Form("{}"),
    db: Session = Depends(get_db)
):
    """Upload document with enhanced amendment handling"""
    try:
        # Validate file
        if not file.filename:
            raise HTTPException(status_code=400, detail="No file provided")
        
        # Read file content
        file_content = await file.read()
        if len(file_content) == 0:
            raise HTTPException(status_code=400, detail="Empty file")
        
        # Parse metadata
        try:
            metadata_dict = json.loads(metadata)
        except json.JSONDecodeError:
            metadata_dict = {}
        
        print(f"Uploading file: {file.filename}, metadata: {metadata_dict}")
        
        # Process document
        result = processor.process_contract(file_content, metadata_dict)
        
        # Save to database
        document = models.Document(
            filename=file.filename,
            file_type=file.content_type,
            file_size=len(file_content),
            is_amendment=metadata_dict.get('is_amendment', False),
            parent_document_id=metadata_dict.get('parent_document_id'),
            amendment_type=metadata_dict.get('amendment_type'),
            status="uploaded"
        )
        
        db.add(document)
        db.commit()
        db.refresh(document)
        
        # Create contract entry
        def create_contract_from_extraction(extraction: Dict[str, Any], document_id: int, db: Session):
            """Create contract from extraction result"""
            try:
                # Helper function to clean date values
                def clean_date(date_value):
                    """Convert empty strings to None for date fields"""
                    if not date_value or date_value == "" or date_value == "Unknown":
                        return None
                    return date_value
                
                # Clean all JSON fields
                deliverables_cleaned = clean_json_for_db(extraction.get("deliverables", []))
                extracted_tables_cleaned = clean_json_for_db(extraction.get("extracted_tables", {}))
                key_fields_cleaned = clean_json_for_db(extraction.get("key_fields", {}))
                metadata_cleaned = clean_json_for_db(extraction.get("metadata", {}))
                parties_cleaned = clean_json_for_db(extraction.get("parties", []))
                service_levels_cleaned = clean_json_for_db(extraction.get("service_levels", {}))
                
                # Get signatories, contacts, and clauses from multiple possible locations
                signatories_list = []
                contacts_list = []
                clauses_dict = {}
                
                if extraction.get("contact_information"):
                    if extraction["contact_information"].get("signatories"):
                        signatories_list = extraction["contact_information"]["signatories"]
                    if extraction["contact_information"].get("administrative_contacts"):
                        contacts_list = extraction["contact_information"]["administrative_contacts"]
                
                if not signatories_list and extraction.get("signatories"):
                    signatories_list = extraction["signatories"]
                
                if not contacts_list and extraction.get("contacts"):
                    contacts_list = extraction["contacts"]
                
                # Extract clauses - ensure it's not empty dict or string
                if extraction.get("clauses"):
                    clauses_dict = extraction["clauses"]
                # If clauses is empty or not found, try to extract from key_fields
                if not clauses_dict or clauses_dict == {}:
                    # Look for clause information in key_fields or other sections
                    key_fields = extraction.get("key_fields", {})
                    if key_fields:
                        # Build clauses from key_fields that represent clauses
                        clause_keywords = ["confidentiality", "indemnification", "liability", "termination", "renewal", "termination_clause"]
                        for field_name, field_data in key_fields.items():
                            if any(keyword in field_name.lower() for keyword in clause_keywords):
                                if isinstance(field_data, dict):
                                    clauses_dict[field_name] = field_data
                                else:
                                    clauses_dict[field_name] = {"text": str(field_data), "category": field_name}
                
                clauses_cleaned = clean_json_for_db(clauses_dict if clauses_dict else {})
                signatories_cleaned = clean_json_for_db(signatories_list)
                contacts_cleaned = clean_json_for_db(contacts_list)
                
                # Extract risk factors
                def extract_risk_factors(extraction_data):
                    """Extract risk factors from the extraction result"""
                    risk_factors = []
                    
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
                    
                    financial = extraction_data.get("financial", {})
                    if financial.get("total_value", 0) > 1000000:
                        risk_factors.append({
                            "factor": "High Contract Value",
                            "severity": "high" if financial.get("total_value", 0) > 5000000 else "medium",
                            "mitigation": "Additional review required",
                            "confidence": 1.0
                        })
                    
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
                
                risk_factors_list = extract_risk_factors(extraction)
                risk_factors_cleaned = clean_json_for_db(risk_factors_list)
                
                contract = models.Contract(
                    document_id=document_id,
                    contract_type=extraction.get("contract_type", "Unknown"),
                    contract_subtype=extraction.get("contract_subtype"),
                    master_agreement_id=extraction.get("master_agreement_id"),
                    parties=parties_cleaned,
                    effective_date=clean_date(extraction.get("dates", {}).get("effective_date")),
                    expiration_date=clean_date(extraction.get("dates", {}).get("expiration_date")),
                    execution_date=clean_date(extraction.get("dates", {}).get("execution_date")),
                    termination_date=clean_date(extraction.get("dates", {}).get("termination_date")),
                    total_value=extraction.get("financial", {}).get("total_value"),
                    currency=extraction.get("financial", {}).get("currency"),
                    payment_terms=extraction.get("financial", {}).get("payment_terms"),
                    billing_frequency=extraction.get("financial", {}).get("billing_frequency"),
                    signatories=signatories_cleaned,
                    contacts=contacts_cleaned,
                    auto_renewal=extraction.get("risk_indicators", {}).get("auto_renewal"),
                    renewal_notice_period=extraction.get("dates", {}).get("notice_period_days"),
                    termination_notice_period=extraction.get("dates", {}).get("notice_period_days"),
                    governing_law=extraction.get("key_fields", {}).get("governing_law", {}).get("value") if extraction.get("key_fields", {}).get("governing_law") else None,
                    jurisdiction=extraction.get("key_fields", {}).get("governing_law", {}).get("value") if extraction.get("key_fields", {}).get("governing_law") else None,
                    confidentiality=extraction.get("clauses", {}).get("confidentiality") is not None,
                    indemnification=extraction.get("clauses", {}).get("indemnification") is not None,
                    liability_cap=extraction.get("key_fields", {}).get("liability_cap", {}).get("value") if extraction.get("key_fields", {}).get("liability_cap") else None,
                    insurance_requirements=extraction.get("compliance_requirements", {}).get("minimum_coverage"),
                    service_levels=service_levels_cleaned,
                    deliverables=deliverables_cleaned,
                    risk_score=extraction.get("risk_score", 0.0),
                    risk_factors=risk_factors_cleaned,
                    clauses=clauses_cleaned,
                    key_fields=key_fields_cleaned,
                    extracted_metadata=metadata_cleaned,
                    extracted_tables_data=extracted_tables_cleaned,
                    confidence_score=extraction.get("confidence_score", 0.0),
                    version=1,
                    needs_review=True,
                    change_summary="Initial extraction"
                )
                
                db.add(contract)
                db.commit()
                db.refresh(contract)
                
                return contract
                
            except Exception as e:
                print(f"Error creating contract from extraction: {e}")
                raise
        
        contract = create_contract_from_extraction(result, document.id, db)
        
        # Initialize response data
        response_data = {
            "id": document.id,
            "filename": document.filename,
            "file_type": document.file_type,
            "file_size": document.file_size,
            "upload_date": document.upload_date,
            "status": document.status,
            "version": document.version,
            "is_amendment": document.is_amendment,
            "parent_document_id": document.parent_document_id,
            "amendment_type": document.amendment_type,
            "contract_id": contract.id,
            "amendment_applied": False,
            "parent_updated": False,
            "new_parent_version": None
        }
        
        # NEW: If this is an amendment, auto-apply to parent contract
        if metadata_dict.get('is_amendment') and metadata_dict.get('parent_document_id'):
            try:
                print(f"Processing as amendment for parent document: {metadata_dict['parent_document_id']}")
                
                # Get parent document
                parent_doc = db.query(models.Document).filter(
                    models.Document.id == metadata_dict['parent_document_id']
                ).first()
                
                if parent_doc:
                    print(f"Found parent document: {parent_doc.filename}")
                    
                    # Get latest version of parent contract
                    parent_contract = db.query(models.Contract).filter(
                        models.Contract.document_id == parent_doc.id
                    ).order_by(models.Contract.version.desc()).first()
                    
                    if parent_contract:
                        print(f"Found parent contract v{parent_contract.version}: {parent_contract.contract_type}")
                        
                        # Create updated version of parent contract
                        updated_parent = apply_contract_amendment(parent_contract, contract)
                        updated_parent.previous_version_id = parent_contract.id
                        updated_parent.version = parent_contract.version + 1
                        updated_parent.change_summary = f"Auto-amended by {file.filename} ({metadata_dict.get('amendment_type', 'modification')})"
                        
                        # Set document_id to parent's document_id (same document, new contract version)
                        updated_parent.document_id = parent_contract.document_id
                        
                        # Add to database
                        db.add(updated_parent)
                        
                        # Create amendment relationship
                        try:
                            from app.models import ContractAmendment
                            amendment_rel = ContractAmendment(
                                parent_contract_id=parent_contract.id,
                                amendment_contract_id=contract.id,
                                applied_date=datetime.now(),
                                changes_applied=json.dumps({
                                    "summary": updated_parent.change_summary,
                                    "amendment_type": metadata_dict.get('amendment_type'),
                                    "changes": {
                                        "total_value": {
                                            "old": parent_contract.total_value,
                                            "new": updated_parent.total_value
                                        } if parent_contract.total_value != updated_parent.total_value else None,
                                        "expiration_date": {
                                            "old": parent_contract.expiration_date.isoformat() if parent_contract.expiration_date else None,
                                            "new": updated_parent.expiration_date.isoformat() if updated_parent.expiration_date else None
                                        } if parent_contract.expiration_date != updated_parent.expiration_date else None
                                    }
                                }),
                                version_created=updated_parent.version
                            )
                            db.add(amendment_rel)
                        except:
                            print("Note: ContractAmendment model not available")
                        
                        db.commit()
                        db.refresh(updated_parent)
                        
                        print(f"Created new parent contract version: v{updated_parent.version}")
                        
                        # Update response with amendment info
                        response_data["amendment_applied"] = True
                        response_data["parent_updated"] = True
                        response_data["new_parent_version"] = updated_parent.version
                        response_data["new_parent_contract_id"] = updated_parent.id
                        
                        # Also update the amendment contract to reference the new parent version
                        contract.previous_version_id = parent_contract.id
                        db.commit()
                        
                        print(f"Amendment successfully applied. Parent updated to v{updated_parent.version}")
                        
                    else:
                        print(f"No parent contract found for document {parent_doc.id}")
                else:
                    print(f"Parent document {metadata_dict['parent_document_id']} not found")
                    
            except Exception as amendment_error:
                print(f"Auto-amendment failed (non-critical): {amendment_error}")
                import traceback
                traceback.print_exc()
                # Continue without failing the upload
                response_data["amendment_error"] = str(amendment_error)
        
        # Create embeddings for RAG
        try:
            from app.agents.enhanced_rag_engine import EnhancedRAGEngine
            rag_engine = EnhancedRAGEngine()
            
            # Extract text for embeddings
            text_result = processor.extract_text_from_pdf(file_content)
            plain_text = text_result.get("text", "")
            
            if plain_text:
                # Create embeddings in ChromaDB
                embeddings = rag_engine.create_embeddings(
                    plain_text, 
                    contract.id, 
                    contract.version
                )
                print(f"Created {len(embeddings)} embeddings for contract {contract.id}")
                
                # Save to database as well
                for embedding_data in embeddings:
                    rag_embedding = models.RAGEmbedding(
                        contract_id=contract.id,
                        text_chunk=embedding_data.get("text"),
                        chunk_metadata=embedding_data.get("metadata"),
                        chroma_chunk_id=embedding_data.get("chunk_id"),
                        vector_db_type="chromadb"
                    )
                    db.add(rag_embedding)
                
                db.commit()
        except Exception as e:
            print(f"Error creating embeddings (non-critical): {e}")
        
        print(f"Document upload complete: {file.filename} (ID: {document.id})")
        return response_data
        
    except Exception as e:
        db.rollback()
        print(f"Error uploading document: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error uploading document: {str(e)}")





# from fastapi import FastAPI, UploadFile, File, HTTPException, Depends, Form
# from fastapi.middleware.cors import CORSMiddleware
# from sqlalchemy.orm import Session
# from typing import List, Dict, Any
# import os
# from pathlib import Path
# from dotenv import load_dotenv
# from app.database import SessionLocal
# from datetime import datetime
# import math
# # Load .env file from the project root
# env_path = Path("C:/saple.ai/OCR/backend/.env")
# if env_path.exists():
#     print(f"Loading .env file from: {env_path}")
#     load_dotenv(dotenv_path=env_path, override=True)
# else:
#     # Try alternative path
#     env_path = Path(".env")
#     if env_path.exists():
#         print(f"Loading .env file from: {env_path}")
#         load_dotenv(dotenv_path=env_path, override=True)
#     else:
#         print("Warning: .env file not found. Using system environment variables.")

# # Now load other imports
# from app.database import get_db, engine
# from . import models
# from . import schemas
# from .agents.contract_processor import ContractProcessor
# from .agents.rag_engine import RAGEngine
# from .agents.enhanced_rag_engine import EnhancedRAGEngine
# import json
# from datetime import datetime
# from typing import Optional

# # Debug: Check if OPENAI_API_KEY is loaded
# api_key = os.getenv("OPENAI_API_KEY")
# if api_key:
#     print(f"OPENAI_API_KEY loaded: {api_key[:10]}...{api_key[-4:] if len(api_key) > 14 else '***'}")
# else:
#     print("Warning: OPENAI_API_KEY not found in environment")

# app = FastAPI(title="Contract Intelligence Agent")

# # CORS
# app.add_middleware(
#     CORSMiddleware,
#     allow_origins=os.getenv("ALLOWED_ORIGINS", "*").split(","),
#     allow_credentials=True,
#     allow_methods=["*"],
#     allow_headers=["*"],
# )

# # Initialize models
# models.Base.metadata.create_all(bind=engine)

# processor = ContractProcessor()
# rag_engine = RAGEngine()

# @app.get("/contracts/summary")
# async def get_contracts_summary(db: Session = Depends(get_db)):
#     """Get comprehensive contract summary"""
#     from sqlalchemy import func, case, and_
#     from datetime import datetime, timedelta
    
#     # Calculate statistics
#     total_contracts = db.query(func.count(models.Contract.id)).scalar() or 0
    
#     # Total value
#     total_value_result = db.query(
#         func.sum(
#             case(
#                 (models.Contract.currency == 'USD', models.Contract.total_value),
#                 else_=0
#             )
#         )
#     ).scalar() or 0
    
#     # Expiring soon (within 90 days)
#     ninety_days = datetime.now() + timedelta(days=90)
#     expiring_soon = db.query(func.count(models.Contract.id)).filter(
#         and_(
#             models.Contract.expiration_date.isnot(None),
#             models.Contract.expiration_date <= ninety_days
#         )
#     ).scalar() or 0
    
#     # High risk contracts
#     high_risk = db.query(func.count(models.Contract.id)).filter(
#         models.Contract.risk_score >= 0.7
#     ).scalar() or 0
    
#     # Needs review
#     needs_review = db.query(func.count(models.Contract.id)).filter(
#         models.Contract.needs_review == True
#     ).scalar() or 0
    
#     # By type
#     by_type = dict(db.query(
#         models.Contract.contract_type,
#         func.count(models.Contract.id)
#     ).group_by(models.Contract.contract_type).all())
    
#     # By status
#     by_status = {
#         "active": db.query(func.count(models.Contract.id)).filter(
#             models.Contract.expiration_date > datetime.now()
#         ).scalar() or 0,
#         "expired": db.query(func.count(models.Contract.id)).filter(
#             and_(
#                 models.Contract.expiration_date.isnot(None),
#                 models.Contract.expiration_date <= datetime.now()
#             )
#         ).scalar() or 0,
#         "terminated": db.query(func.count(models.Contract.id)).filter(
#             models.Contract.termination_date.isnot(None)
#         ).scalar() or 0
#     }
    
#     return {
#         "total_contracts": total_contracts,
#         "total_value": float(total_value_result),
#         "expiring_soon": expiring_soon,
#         "high_risk": high_risk,
#         "needs_review": needs_review,
#         "by_type": by_type,
#         "by_status": by_status
#     }

# @app.get("/contracts/{contract_id}/versions")
# async def get_contract_versions(
#     contract_id: int,
#     db: Session = Depends(get_db)
# ):
#     """Get all versions of a contract"""
#     contract = db.query(models.Contract).filter(
#         models.Contract.id == contract_id
#     ).first()
    
#     if not contract:
#         raise HTTPException(status_code=404, detail="Contract not found")
    
#     # Find all versions (follow previous_version chain)
#     versions = []
#     current = contract
    
#     while current:
#         versions.append(current)
#         if current.previous_version_id:
#             current = db.query(models.Contract).filter(
#                 models.Contract.id == current.previous_version_id
#             ).first()
#         else:
#             current = None
    
#     versions.reverse()  # Oldest first
#     return versions

# @app.get("/contracts/{contract_id}/deltas")
# async def get_contract_deltas(
#     contract_id: int,
#     version_from: Optional[int] = None,
#     version_to: Optional[int] = None,
#     db: Session = Depends(get_db)
# ):
#     """Get changes between contract versions"""
#     contract = db.query(models.Contract).filter(
#         models.Contract.id == contract_id
#     ).first()
    
#     if not contract:
#         raise HTTPException(status_code=404, detail="Contract not found")
    
#     # Get specific versions or all deltas
#     if version_from and version_to:
#         deltas = db.query(models.ContractDelta).filter(
#             and_(
#                 models.ContractDelta.contract_id == contract_id,
#                 models.ContractDelta.previous_version_id == version_from
#             )
#         ).all()
#     else:
#         deltas = db.query(models.ContractDelta).filter(
#             models.ContractDelta.contract_id == contract_id
#         ).order_by(models.ContractDelta.detected_at.desc()).all()
    
#     return deltas

# @app.get("/contracts/search/advanced")
# async def advanced_search(
#     query: Optional[str] = None,
#     contract_type: Optional[str] = None,
#     party_name: Optional[str] = None,
#     min_value: Optional[float] = None,
#     max_value: Optional[float] = None,
#     start_date: Optional[datetime] = None,
#     end_date: Optional[datetime] = None,
#     risk_level: Optional[str] = None,
#     needs_review: Optional[bool] = None,
#     skip: int = 0,
#     limit: int = 50,
#     db: Session = Depends(get_db)
# ):
#     """Advanced contract search with filters"""
#     from sqlalchemy import or_, and_
    
#     query_builder = db.query(models.Contract)
    
#     # Text search
#     if query:
#         query_builder = query_builder.filter(
#             or_(
#                 models.Contract.contract_type.ilike(f"%{query}%"),
#                 models.Contract.parties.cast(String).ilike(f"%{query}%"),
#                 models.Contract.clauses.cast(String).ilike(f"%{query}%")
#             )
#         )
    
#     # Type filter
#     if contract_type:
#         query_builder = query_builder.filter(
#             models.Contract.contract_type == contract_type
#         )
    
#     # Party filter
#     if party_name:
#         query_builder = query_builder.filter(
#             models.Contract.parties.cast(String).ilike(f"%{party_name}%")
#         )
    
#     # Value range filter
#     if min_value is not None or max_value is not None:
#         if min_value is not None and max_value is not None:
#             query_builder = query_builder.filter(
#                 and_(
#                     models.Contract.total_value >= min_value,
#                     models.Contract.total_value <= max_value
#                 )
#             )
#         elif min_value is not None:
#             query_builder = query_builder.filter(
#                 models.Contract.total_value >= min_value
#             )
#         elif max_value is not None:
#             query_builder = query_builder.filter(
#                 models.Contract.total_value <= max_value
#             )
    
#     # Date range filter
#     if start_date or end_date:
#         date_filter = []
#         if start_date:
#             date_filter.append(models.Contract.effective_date >= start_date)
#         if end_date:
#             date_filter.append(models.Contract.expiration_date <= end_date)
#         query_builder = query_builder.filter(and_(*date_filter))
    
#     # Risk level filter
#     if risk_level:
#         risk_thresholds = {
#             "low": (0.0, 0.3),
#             "medium": (0.3, 0.7),
#             "high": (0.7, 1.0)
#         }
#         if risk_level in risk_thresholds:
#             min_risk, max_risk = risk_thresholds[risk_level]
#             query_builder = query_builder.filter(
#                 and_(
#                     models.Contract.risk_score >= min_risk,
#                     models.Contract.risk_score <= max_risk
#                 )
#             )
    
#     # Review status filter
#     if needs_review is not None:
#         query_builder = query_builder.filter(
#             models.Contract.needs_review == needs_review
#         )
    
#     # Execute query
#     contracts = query_builder.offset(skip).limit(limit).all()
#     total = query_builder.count()
    
#     return {
#         "total": total,
#         "skip": skip,
#         "limit": limit,
#         "contracts": contracts
#     }


# # Update the upload endpoint to handle amendments
# @app.post("/upload", response_model=schemas.DocumentResponse)
# async def upload_document(
#     file: UploadFile = File(...),
#     is_amendment: bool = False,
#     parent_document_id: Optional[int] = None,
#     amendment_type: Optional[str] = None,
#     db: Session = Depends(get_db)
# ):
#     """Enhanced upload with amendment support"""
#     print(f"Enhanced upload: {file.filename}, Amendment: {is_amendment}")
    
#     try:
#         contents = await file.read()
#         print(f"File size: {len(contents)} bytes")
        
#         # Validate
#         if not file.filename.lower().endswith('.pdf'):
#             raise HTTPException(status_code=400, detail="Only PDF files are supported")
        
#         # Check parent document if amendment
#         if is_amendment and parent_document_id:
#             parent = db.query(models.Document).filter(
#                 models.Document.id == parent_document_id
#             ).first()
#             if not parent:
#                 raise HTTPException(status_code=404, detail="Parent document not found")
        
#         # Save document
#         db_document = models.Document(
#             filename=file.filename,
#             file_type=file.content_type,
#             file_size=len(contents),
#             status="uploaded",
#             is_amendment=is_amendment,
#             parent_document_id=parent_document_id if is_amendment else None,
#             amendment_type=amendment_type if is_amendment else None
#         )
#         db.add(db_document)
#         db.commit()
#         db.refresh(db_document)
#         print(f"Document saved with ID: {db_document.id}")
        
#         # Extract text synchronously for validation
#         text_result = processor.extract_text_from_pdf(contents)
#         plain_text = text_result.get("text", "")

#         if not plain_text or len(plain_text.strip()) < 50:
#             db_document.status = "failed: Could not extract text"
#             db.commit()
#             raise HTTPException(
#                 status_code=400, 
#                 detail="Could not extract text from PDF"
#             )
        
#         print(f"Text extraction successful, starting async processing")
        
#         # Process asynchronously with amendment info
#         import threading
#         thread = threading.Thread(
#             target=process_document_async,
#             args=(db_document.id, contents, db, is_amendment, parent_document_id),
#             kwargs={} 
#         )
#         thread.daemon = True
#         thread.start()
        
#         return db_document
        
#     except Exception as e:
#         print(f"Upload error: {str(e)}")
#         import traceback
#         traceback.print_exc()
#         if isinstance(e, HTTPException):
#             raise e
#         raise HTTPException(status_code=500, detail=str(e))
        
# @app.get("/contracts", response_model=List[schemas.ContractResponse])
# async def get_contracts(
#     skip: int = 0,
#     limit: int = 100,
#     db: Session = Depends(get_db)
# ):
#     """Get all contracts"""
#     contracts = db.query(models.Contract)\
#         .offset(skip)\
#         .limit(limit)\
#         .all()
    
#     # Ensure all fields are properly serialized
#     contract_list = []
#     for contract in contracts:
#         contract_dict = contract.__dict__.copy()
        
#         # Ensure signatories and contacts are properly formatted
#         if isinstance(contract_dict.get('signatories'), str):
#             try:
#                 contract_dict['signatories'] = json.loads(contract_dict['signatories'])
#             except:
#                 contract_dict['signatories'] = []
        
#         if isinstance(contract_dict.get('contacts'), str):
#             try:
#                 contract_dict['contacts'] = json.loads(contract_dict['contacts'])
#             except:
#                 contract_dict['contacts'] = []
        
#         # Ensure parties is a list
#         if isinstance(contract_dict.get('parties'), str):
#             try:
#                 contract_dict['parties'] = json.loads(contract_dict['parties'])
#             except:
#                 contract_dict['parties'] = []
#         elif contract_dict.get('parties') is None:
#             contract_dict['parties'] = []
        
#         # Convert dates to ISO format
#         for date_field in ['effective_date', 'expiration_date', 'execution_date', 'termination_date']:
#             if contract_dict.get(date_field) and hasattr(contract_dict[date_field], 'isoformat'):
#                 contract_dict[date_field] = contract_dict[date_field].isoformat()
        
#         contract_list.append(contract_dict)
    
#     return contract_list

# @app.get("/contracts/{contract_id}", response_model=schemas.ContractResponse)
# async def get_contract(
#     contract_id: int,
#     db: Session = Depends(get_db)
# ):
#     """Get specific contract"""
#     contract = db.query(models.Contract)\
#         .filter(models.Contract.id == contract_id)\
#         .first()
    
#     if not contract:
#         raise HTTPException(status_code=404, detail="Contract not found")
    
#     return contract

# @app.post("/search")
# async def search_contracts(
#     query: schemas.SearchQuery,
#     db: Session = Depends(get_db)
# ):
#     """Search contracts using RAG"""
#     # Get all embeddings
#     embeddings = db.query(models.RAGEmbedding).all()
    
#     if not embeddings:
#         return {"results": []}
    
#     # Search similar
#     embedding_list = [e.embedding for e in embeddings]
#     similar_indices = rag_engine.search_similar(query.query, embedding_list)
    
#     # Get relevant contracts
#     results = []
#     for idx in similar_indices:
#         emb = embeddings[idx]
#         contract = db.query(models.Contract)\
#             .filter(models.Contract.id == emb.contract_id)\
#             .first()
        
#         if contract:
#             # Generate answer
#             answer = rag_engine.answer_query(query.query, emb.text_chunk)
#             results.append({
#                 "contract_id": contract.id,
#                 "contract_type": contract.contract_type,
#                 "relevance_text": answer,
#                 "confidence": 0.85  # Placeholder
#             })
    
#     return {"results": results[:query.limit]}




# @app.post("/contracts/{contract_id}/apply-amendment", response_model=Dict[str, Any])
# async def apply_amendment_to_contract(
#     contract_id: int,
#     amendment_id: int,
#     db: Session = Depends(get_db)
# ):
#     """
#     Apply amendment changes to the parent contract
#     """
#     try:
#         # Get parent contract
#         parent_contract = db.query(models.Contract).filter(models.Contract.id == contract_id).first()
#         if not parent_contract:
#             raise HTTPException(status_code=404, detail="Parent contract not found")
        
#         # Get amendment contract
#         amendment = db.query(models.Contract).filter(models.Contract.id == amendment_id).first()
#         if not amendment:
#             raise HTTPException(status_code=404, detail="Amendment not found")
        
#         # Get the amendment document
#         amendment_doc = db.query(models.Document).filter(
#             models.Document.id == amendment.document_id,
#             models.Document.is_amendment == True
#         ).first()
        
#         if not amendment_doc or amendment_doc.parent_document_id is None:
#             raise HTTPException(status_code=400, detail="Invalid amendment document")
        
#         # Apply amendment changes to parent contract
#         updated_contract = apply_contract_amendment(parent_contract, amendment)
        
#         # Save the updated contract as a new version
#         updated_contract.previous_version_id = parent_contract.id
#         updated_contract.version = parent_contract.version + 1
#         updated_contract.change_summary = f"Amended by amendment {amendment_id} ({amendment_doc.amendment_type})"
#         updated_contract.extraction_date = datetime.now()
        
#         db.add(updated_contract)
#         db.commit()
#         db.refresh(updated_contract)
        
#         # Create relationship record
#         from app.models import ContractAmendment
#         amendment_rel = ContractAmendment(
#             parent_contract_id=parent_contract.id,
#             amendment_contract_id=amendment.id,
#             applied_date=datetime.now(),
#             changes_applied=json.dumps(updated_contract.change_summary)
#         )
#         db.add(amendment_rel)
#         db.commit()
        
#         return {
#             "success": True,
#             "message": f"Amendment applied successfully. New version: v{updated_contract.version}",
#             "parent_contract_id": parent_contract.id,
#             "amendment_id": amendment_id,
#             "new_version_id": updated_contract.id,
#             "changes": updated_contract.change_summary
#         }
        
#     except Exception as e:
#         db.rollback()
#         raise HTTPException(status_code=500, detail=f"Error applying amendment: {str(e)}")

# def apply_contract_amendment(parent_contract: models.Contract, amendment: models.Contract) -> models.Contract:
#     """
#     Apply amendment changes to parent contract
#     Returns a new Contract object with updated values
#     """
#     # Create a copy of parent contract
#     updated_contract = models.Contract()
    
#     # Copy all fields from parent (excluding auto-generated ones)
#     excluded_fields = ['id', 'version', 'previous_version_id', 'extraction_date', 
#                       'change_summary', 'last_updated', 'reviewed_by', 'review_date']
    
#     for key, value in parent_contract.__dict__.items():
#         if not key.startswith('_') and key not in excluded_fields:
#             setattr(updated_contract, key, value)
    
#     # Get amendment type
#     amendment_type = amendment.document.amendment_type if amendment.document else 'modification'
    
#     print(f"Applying {amendment_type} amendment to contract v{parent_contract.version}")
    
#     # Update financial values
#     if amendment.total_value is not None:
#         if amendment_type in ['modification', 'correction']:
#             # Direct replacement
#             updated_contract.total_value = amendment.total_value
#             print(f"  - Total value modified: {parent_contract.total_value} -> {amendment.total_value}")
        
#         elif amendment_type == 'addendum':
#             # Add to existing value
#             old_value = parent_contract.total_value or 0
#             amendment_value = amendment.total_value or 0
#             updated_contract.total_value = old_value + amendment_value
#             print(f"  - Total value added: {old_value} + {amendment_value} = {updated_contract.total_value}")
        
#         elif amendment_type in ['extension', 'renewal']:
#             # For extensions/renewals, update if different
#             if amendment.total_value != parent_contract.total_value:
#                 updated_contract.total_value = amendment.total_value
#                 print(f"  - Total value updated for {amendment_type}: {parent_contract.total_value} -> {amendment.total_value}")
        
#         elif amendment_type == 'termination':
#             # For termination, set to 0 or reduced value
#             if amendment.total_value == 0:
#                 updated_contract.total_value = 0
#                 print(f"  - Total value terminated: {parent_contract.total_value} -> 0")
#             else:
#                 updated_contract.total_value = amendment.total_value
#                 print(f"  - Total value reduced: {parent_contract.total_value} -> {amendment.total_value}")
    
#     # Update currency if provided
#     if amendment.currency:
#         if amendment.currency != parent_contract.currency:
#             updated_contract.currency = amendment.currency
#             print(f"  - Currency changed: {parent_contract.currency} -> {amendment.currency}")
    
#     # Update dates
#     if amendment.effective_date:
#         if amendment.effective_date != parent_contract.effective_date:
#             updated_contract.effective_date = amendment.effective_date
#             print(f"  - Effective date updated: {parent_contract.effective_date} -> {amendment.effective_date}")
    
#     if amendment.expiration_date:
#         if amendment_type in ['extension', 'renewal']:
#             # For extensions/renewals, update expiration date
#             updated_contract.expiration_date = amendment.expiration_date
#             print(f"  - Expiration date {amendment_type}: {parent_contract.expiration_date} -> {amendment.expiration_date}")
#         elif amendment.expiration_date != parent_contract.expiration_date:
#             updated_contract.expiration_date = amendment.expiration_date
#             print(f"  - Expiration date updated: {parent_contract.expiration_date} -> {amendment.expiration_date}")
    
#     if amendment.execution_date and amendment.execution_date != parent_contract.execution_date:
#         updated_contract.execution_date = amendment.execution_date
    
#     if amendment.termination_date:
#         updated_contract.termination_date = amendment.termination_date
#         print(f"  - Termination date set: {amendment.termination_date}")
    
#     # Update payment terms
#     if amendment.payment_terms and amendment.payment_terms != parent_contract.payment_terms:
#         updated_contract.payment_terms = amendment.payment_terms
#         print(f"  - Payment terms updated: {parent_contract.payment_terms} -> {amendment.payment_terms}")
    
#     # Update billing frequency
#     if amendment.billing_frequency and amendment.billing_frequency != parent_contract.billing_frequency:
#         updated_contract.billing_frequency = amendment.billing_frequency
    
#     # Update parties (append for addendum, replace for modification)
#     if amendment.parties:
#         if amendment_type == 'addendum':
#             # Add new parties
#             existing_parties = set(parent_contract.parties or [])
#             new_parties = set(amendment.parties)
#             updated_contract.parties = list(existing_parties.union(new_parties))
            
#             added_parties = new_parties - existing_parties
#             if added_parties:
#                 print(f"  - Added parties: {list(added_parties)}")
#         else:
#             # Replace parties
#             if set(amendment.parties) != set(parent_contract.parties or []):
#                 updated_contract.parties = amendment.parties
#                 print(f"  - Parties updated")
    
#     # Update clauses (merge)
#     if amendment.clauses:
#         parent_clauses = parent_contract.clauses or {}
#         amendment_clauses = amendment.clauses or {}
        
#         if amendment_type == 'addendum':
#             # Add new clauses
#             updated_contract.clauses = {**parent_clauses, **amendment_clauses}
            
#             new_clauses = set(amendment_clauses.keys()) - set(parent_clauses.keys())
#             if new_clauses:
#                 print(f"  - Added clauses: {list(new_clauses)}")
#         else:
#             # Update existing clauses
#             updated_clauses = parent_clauses.copy()
#             for clause_name, clause_value in amendment_clauses.items():
#                 if clause_name not in parent_clauses or parent_clauses[clause_name] != clause_value:
#                     updated_clauses[clause_name] = clause_value
#                     print(f"  - Clause '{clause_name}' updated")
#             updated_contract.clauses = updated_clauses
    
#     # Update key fields
#     if amendment.key_fields:
#         parent_fields = parent_contract.key_fields or {}
#         amendment_fields = amendment.key_fields or {}
        
#         if amendment_type == 'addendum':
#             updated_contract.key_fields = {**parent_fields, **amendment_fields}
#         else:
#             updated_fields = parent_fields.copy()
#             for field_name, field_value in amendment_fields.items():
#                 if field_name not in parent_fields or parent_fields[field_name] != field_value:
#                     updated_fields[field_name] = field_value
#             updated_contract.key_fields = updated_fields
    
#     # Update signatories
#     if amendment.signatories:
#         if amendment_type == 'addendum':
#             # Add new signatories
#             existing_signatories = parent_contract.signatories or []
#             updated_contract.signatories = existing_signatories + amendment.signatories
#             print(f"  - Added {len(amendment.signatories)} signatories")
#         else:
#             # Replace signatories
#             updated_contract.signatories = amendment.signatories
#             print(f"  - Signatories updated")
    
#     # Update auto-renewal
#     if amendment.auto_renewal is not None and amendment.auto_renewal != parent_contract.auto_renewal:
#         updated_contract.auto_renewal = amendment.auto_renewal
#         print(f"  - Auto-renewal changed: {parent_contract.auto_renewal} -> {amendment.auto_renewal}")
    
#     # Update termination notice period
#     if amendment.termination_notice_period is not None and amendment.termination_notice_period != parent_contract.termination_notice_period:
#         updated_contract.termination_notice_period = amendment.termination_notice_period
#         print(f"  - Termination notice period: {parent_contract.termination_notice_period} -> {amendment.termination_notice_period}")
    
#     # Update renewal notice period
#     if amendment.renewal_notice_period is not None and amendment.renewal_notice_period != parent_contract.renewal_notice_period:
#         updated_contract.renewal_notice_period = amendment.renewal_notice_period
    
#     # Update extracted tables data
#     if amendment.extracted_tables_data:
#         parent_tables = parent_contract.extracted_tables_data or {"tables": []}
#         amendment_tables = amendment.extracted_tables_data or {"tables": []}
        
#         if amendment_type == 'addendum':
#             # Append tables
#             updated_tables = parent_tables.copy()
#             if "tables" in updated_tables and "tables" in amendment_tables:
#                 updated_tables["tables"].extend(amendment_tables["tables"])
#             updated_contract.extracted_tables_data = updated_tables
#             print(f"  - Added {len(amendment_tables.get('tables', []))} tables")
#         else:
#             # Update tables
#             updated_contract.extracted_tables_data = amendment_tables
#             print(f"  - Tables updated")
    
#     # Update contract type/subtype if changed
#     if amendment.contract_type and amendment.contract_type != parent_contract.contract_type:
#         updated_contract.contract_type = amendment.contract_type
    
#     if amendment.contract_subtype and amendment.contract_subtype != parent_contract.contract_subtype:
#         updated_contract.contract_subtype = amendment.contract_subtype
    
#     # Update master agreement ID
#     if amendment.master_agreement_id and amendment.master_agreement_id != parent_contract.master_agreement_id:
#         updated_contract.master_agreement_id = amendment.master_agreement_id
    
#     # Update needs_review flag (amendments should be reviewed)
#     updated_contract.needs_review = True
    
#     # Update confidence score (use the higher of the two)
#     updated_contract.confidence_score = max(parent_contract.confidence_score or 0, amendment.confidence_score or 0)
    
#     # Recalculate risk score based on updated values
#     try:
#         from app.agents.contract_processor import ContractProcessor
#         processor = ContractProcessor()
        
#         # Create a mock extraction dict for risk calculation
#         extraction_dict = {
#             "financial": {
#                 "total_value": updated_contract.total_value,
#                 "currency": updated_contract.currency
#             },
#             "dates": {
#                 "expiration_date": updated_contract.expiration_date.isoformat() if updated_contract.expiration_date else None
#             },
#             "risk_indicators": {
#                 "auto_renewal": updated_contract.auto_renewal
#             }
#         }
        
#         updated_contract.risk_score = processor._calculate_enhanced_risk_score(extraction_dict)
#     except:
#         # Keep existing risk score if calculation fails
#         updated_contract.risk_score = parent_contract.risk_score or 0.5
    
#     print(f"Amendment application complete. New total value: {updated_contract.total_value}")
#     return updated_contract
    
# # def apply_contract_amendment(parent_contract: models.Contract, amendment: models.Contract) -> models.Contract:
# #     """
# #     Apply amendment changes to parent contract
# #     Returns a new Contract object with updated values
# #     """
# #     # Create a copy of parent contract
# #     updated_contract = models.Contract()
    
# #     # Copy all fields from parent
# #     for key, value in parent_contract.__dict__.items():
# #         if not key.startswith('_') and key not in ['id', 'version', 'previous_version_id', 'extraction_date', 'change_summary']:
# #             setattr(updated_contract, key, value)
    
# #     # Apply amendment changes
# #     amendment_type = amendment.document.amendment_type if amendment.document else 'modification'
    
# #     # Update financial values
# #     if amendment.total_value is not None:
# #         if amendment_type in ['modification', 'correction']:
# #             # Replace the value
# #             updated_contract.total_value = amendment.total_value
# #         elif amendment_type == 'addendum':
# #             # Add to existing value
# #             updated_contract.total_value = (parent_contract.total_value or 0) + (amendment.total_value or 0)
    
# #     # Update currency if provided
# #     if amendment.currency:
# #         updated_contract.currency = amendment.currency
    
# #     # Update dates
# #     if amendment.effective_date:
# #         updated_contract.effective_date = amendment.effective_date
# #     if amendment.expiration_date:
# #         if amendment_type in ['extension', 'renewal']:
# #             # For extensions, update expiration date
# #             updated_contract.expiration_date = amendment.expiration_date
# #         else:
# #             updated_contract.expiration_date = amendment.expiration_date
    
# #     # Update payment terms
# #     if amendment.payment_terms:
# #         updated_contract.payment_terms = amendment.payment_terms
    
# #     # Update parties (append for addendum, replace for modification)
# #     if amendment.parties:
# #         if amendment_type == 'addendum':
# #             # Add new parties
# #             existing_parties = set(parent_contract.parties or [])
# #             new_parties = set(amendment.parties)
# #             updated_contract.parties = list(existing_parties.union(new_parties))
# #         else:
# #             # Replace parties
# #             updated_contract.parties = amendment.parties
    
# #     # Update clauses (merge)
# #     if amendment.clauses:
# #         parent_clauses = parent_contract.clauses or {}
# #         amendment_clauses = amendment.clauses or {}
        
# #         if amendment_type == 'addendum':
# #             # Add new clauses
# #             updated_contract.clauses = {**parent_clauses, **amendment_clauses}
# #         else:
# #             # Update existing clauses
# #             updated_clauses = parent_clauses.copy()
# #             for clause_name, clause_value in amendment_clauses.items():
# #                 updated_clauses[clause_name] = clause_value
# #             updated_contract.clauses = updated_clauses
    
# #     # Update key fields
# #     if amendment.key_fields:
# #         parent_fields = parent_contract.key_fields or {}
# #         amendment_fields = amendment.key_fields or {}
        
# #         if amendment_type == 'addendum':
# #             updated_contract.key_fields = {**parent_fields, **amendment_fields}
# #         else:
# #             updated_fields = parent_fields.copy()
# #             for field_name, field_value in amendment_fields.items():
# #                 updated_fields[field_name] = field_value
# #             updated_contract.key_fields = updated_fields
    
# #     # Update signatories
# #     if amendment.signatories:
# #         if amendment_type == 'addendum':
# #             # Add new signatories
# #             existing_signatories = parent_contract.signatories or []
# #             updated_contract.signatories = existing_signatories + amendment.signatories
# #         else:
# #             # Replace signatories
# #             updated_contract.signatories = amendment.signatories
    
# #     # Update auto-renewal
# #     if amendment.auto_renewal is not None:
# #         updated_contract.auto_renewal = amendment.auto_renewal
    
# #     # Update termination notice period
# #     if amendment.termination_notice_period is not None:
# #         updated_contract.termination_notice_period = amendment.termination_notice_period
    
# #     # Update extracted tables data
# #     if amendment.extracted_tables_data:
# #         parent_tables = parent_contract.extracted_tables_data or {"tables": []}
# #         amendment_tables = amendment.extracted_tables_data or {"tables": []}
        
# #         if amendment_type == 'addendum':
# #             # Append tables
# #             updated_tables = parent_tables.copy()
# #             if "tables" in updated_tables and "tables" in amendment_tables:
# #                 updated_tables["tables"].extend(amendment_tables["tables"])
# #             updated_contract.extracted_tables_data = updated_tables
# #         else:
# #             # Update tables
# #             updated_contract.extracted_tables_data = amendment_tables
    
# #     return updated_contract


# @app.post("/contracts/{contract_id}/review")
# async def review_contract(
#     contract_id: int,
#     reviewed: bool = True,
#     db: Session = Depends(get_db)
# ):
#     """Mark contract as reviewed"""
#     contract = db.query(models.Contract)\
#         .filter(models.Contract.id == contract_id)\
#         .first()
    
#     if not contract:
#         raise HTTPException(status_code=404, detail="Contract not found")
    
#     contract.needs_review = not reviewed
#     db.commit()
    
#     return {"status": "success"}


# @app.post("/contracts/compare")
# async def compare_contracts(
#     compare_request: schemas.ContractCompareRequest,
#     db: Session = Depends(get_db)
# ):
#     """Compare two contracts for differences"""
#     try:
#         # Get both contracts
#         contract1 = db.query(models.Contract)\
#             .filter(models.Contract.id == compare_request.contract_id_1)\
#             .first()
#         contract2 = db.query(models.Contract)\
#             .filter(models.Contract.id == compare_request.contract_id_2)\
#             .first()
        
#         if not contract1 or not contract2:
#             raise HTTPException(status_code=404, detail="One or both contracts not found")
        
#         # Prepare extraction data for comparison
#         extraction1 = {
#             "contract_type": contract1.contract_type,
#             "contract_subtype": contract1.contract_subtype,
#             "master_agreement_id": contract1.master_agreement_id,
#             "parties": contract1.parties,
#             "dates": {
#                 "effective_date": contract1.effective_date,
#                 "expiration_date": contract1.expiration_date,
#                 "execution_date": contract1.execution_date,
#                 "termination_date": contract1.termination_date,
#             },
#             "financial": {
#                 "total_value": contract1.total_value,
#                 "currency": contract1.currency,
#                 "payment_terms": contract1.payment_terms,
#                 "billing_frequency": contract1.billing_frequency,
#             },
#             "clauses": contract1.clauses or {},
#             "key_fields": contract1.key_fields or {},
#             "confidence_score": contract1.confidence_score,
#         }
        
#         extraction2 = {
#             "contract_type": contract2.contract_type,
#             "contract_subtype": contract2.contract_subtype,
#             "master_agreement_id": contract2.master_agreement_id,
#             "parties": contract2.parties,
#             "dates": {
#                 "effective_date": contract2.effective_date,
#                 "expiration_date": contract2.expiration_date,
#                 "execution_date": contract2.execution_date,
#                 "termination_date": contract2.termination_date,
#             },
#             "financial": {
#                 "total_value": contract2.total_value,
#                 "currency": contract2.currency,
#                 "payment_terms": contract2.payment_terms,
#                 "billing_frequency": contract2.billing_frequency,
#             },
#             "clauses": contract2.clauses or {},
#             "key_fields": contract2.key_fields or {},
#             "confidence_score": contract2.confidence_score,
#         }
        
#         # Use the processor to compare
#         comparison = processor.compare_versions(extraction1, extraction2)
        
#         # Generate AI-powered comparison summary
#         comparison_summary = generate_comparison_summary(
#             contract1, 
#             contract2, 
#             comparison.get("deltas", [])
#         )
        
#         return {
#             "contract1": {
#                 "id": contract1.id,
#                 "contract_type": contract1.contract_type,
#                 "parties": contract1.parties,
#                 "version": contract1.version
#             },
#             "contract2": {
#                 "id": contract2.id,
#                 "contract_type": contract2.contract_type,
#                 "parties": contract2.parties,
#                 "version": contract2.version
#             },
#             "comparison": comparison,
#             "summary": comparison_summary,
#             "suggested_actions": generate_suggested_actions(comparison)
#         }
        
#     except Exception as e:
#         print(f"Error comparing contracts: {e}")
#         raise HTTPException(status_code=500, detail=str(e))

# def generate_comparison_summary(contract1, contract2, deltas):
#     """Generate detailed comparison summary"""
#     if not deltas:
#         return "No changes detected between the two versions."
    
#     # Group changes by category
#     changes_by_category = {
#         "financial": [],
#         "legal": [],
#         "dates": [],
#         "parties": [],
#         "clauses": [],
#         "other": []
#     }
    
#     for delta in deltas:
#         field_name = delta["field_name"].lower()
        
#         if any(term in field_name for term in ["financial", "payment", "value", "amount", "currency"]):
#             changes_by_category["financial"].append(delta)
#         elif any(term in field_name for term in ["clause", "legal", "liability", "indemn", "confidential"]):
#             changes_by_category["legal"].append(delta)
#         elif "date" in field_name:
#             changes_by_category["dates"].append(delta)
#         elif any(term in field_name for term in ["party", "signatory", "contact"]):
#             changes_by_category["parties"].append(delta)
#         elif "clause" in field_name:
#             changes_by_category["clauses"].append(delta)
#         else:
#             changes_by_category["other"].append(delta)
    
#     # Build summary
#     summary_parts = []
    
#     for category, changes in changes_by_category.items():
#         if changes:
#             count = len(changes)
#             added = sum(1 for c in changes if c.get("change_type") == "added")
#             removed = sum(1 for c in changes if c.get("change_type") == "removed")
#             modified = sum(1 for c in changes if c.get("change_type") == "modified")
            
#             category_summary = f"{count} {category} changes"
#             if added or removed or modified:
#                 details = []
#                 if added: details.append(f"{added} added")
#                 if removed: details.append(f"{removed} removed")
#                 if modified: details.append(f"{modified} modified")
#                 category_summary += f" ({', '.join(details)})"
            
#             summary_parts.append(category_summary)
    
#     if summary_parts:
#         return f"Amendment detected. Key changes: {', '.join(summary_parts)}."
    
#     return "Minor changes detected."
    
# def generate_suggested_actions(comparison):
#     """Generate suggested actions based on comparison"""
#     actions = []
#     deltas = comparison.get("deltas", [])
    
#     # Check for high-risk changes
#     high_risk_terms = ["liability", "indemnification", "termination", "penalty", "renewal"]
    
#     for delta in deltas:
#         field_name = delta["field_name"].lower()
#         if any(term in field_name for term in high_risk_terms):
#             actions.append(f"Review {field_name} change - potential risk impact")
    
#     # Check for financial changes
#     financial_changes = [d for d in deltas if "financial" in d["field_name"].lower()]
#     if financial_changes:
#         actions.append("Consult finance team on monetary changes")
    
#     if not actions:
#         actions.append("No critical actions required")
    
#     return actions

# @app.get("/documents/{document_id}/status")
# async def get_document_status(
#     document_id: int,
#     db: Session = Depends(get_db)
# ):
#     """Get document processing status"""
#     document = db.query(models.Document)\
#         .filter(models.Document.id == document_id)\
#         .first()
    
#     if not document:
#         raise HTTPException(status_code=404, detail="Document not found")
    
#     # Check if contract exists for this document
#     contract = db.query(models.Contract)\
#         .filter(models.Contract.document_id == document_id)\
#         .first()
    
#     return {
#         "document_id": document.id,
#         "status": document.status,
#         "is_completed": document.status == "completed",
#         "has_contract": contract is not None,
#         "contract_id": contract.id if contract else None,
#         "upload_date": document.upload_date
#     }    

# @app.get("/contracts/{contract_id}/tables")
# async def get_contract_tables(
#     contract_id: int,
#     db: Session = Depends(get_db)
# ):
#     """Get extracted tables for a contract"""
#     contract = db.query(models.Contract)\
#         .filter(models.Contract.id == contract_id)\
#         .first()
    
#     if not contract:
#         raise HTTPException(status_code=404, detail="Contract not found")
    
#     return {
#         "contract_id": contract_id,
#         "tables_data": contract.extracted_tables_data or {},
#         "has_tables": bool(contract.extracted_tables_data)
#     }

# @app.post("/contracts/rag/search")
# async def rag_search(
#     query: str,
#     contract_ids: Optional[List[int]] = None,
#     limit: int = 5,
#     db: Session = Depends(get_db)
# ):
#     """Search contracts using RAG with vector similarity"""
#     try:
#         enhanced_rag = EnhancedRAGEngine()
        
#         # Perform similarity search
#         similar_chunks = enhanced_rag.search_similar(query, contract_ids, limit)
        
#         # Group by contract
#         results_by_contract = {}
#         for chunk in similar_chunks:
#             contract_id = chunk["contract_id"]
#             if contract_id not in results_by_contract:
#                 # Get contract info
#                 contract = db.query(models.Contract)\
#                     .filter(models.Contract.id == contract_id)\
#                     .first()
                
#                 if contract:
#                     results_by_contract[contract_id] = {
#                         "contract": {
#                             "id": contract.id,
#                             "contract_type": contract.contract_type,
#                             "parties": contract.parties,
#                             "total_value": contract.total_value
#                         },
#                         "chunks": [],
#                         "max_similarity": 0
#                     }
            
#             if contract_id in results_by_contract:
#                 results_by_contract[contract_id]["chunks"].append({
#                     "text": chunk["text_chunk"][:300] + "..." if len(chunk["text_chunk"]) > 300 else chunk["text_chunk"],
#                     "similarity": chunk["similarity"]
#                 })
#                 results_by_contract[contract_id]["max_similarity"] = max(
#                     results_by_contract[contract_id]["max_similarity"],
#                     chunk["similarity"]
#                 )
        
#         # Sort by similarity
#         results = sorted(
#             results_by_contract.values(),
#             key=lambda x: x["max_similarity"],
#             reverse=True
#         )
        
#         return {
#             "query": query,
#             "results": results,
#             "total_results": len(results)
#         }
        
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=str(e))

# @app.get("/contracts/{contract_id}/summary/ai")
# async def get_ai_contract_summary(
#     contract_id: int,
#     db: Session = Depends(get_db)
# ):
#     """Get AI-generated summary of contract"""
#     try:
#         enhanced_rag = EnhancedRAGEngine()
#         summary = enhanced_rag.get_contract_summary(contract_id)
        
#         if "error" in summary:
#             raise HTTPException(status_code=404, detail=summary["error"])
        
#         return summary
        
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=str(e))


# @app.get("/env-check")
# async def environment_check():
#     """Check if environment variables are loaded correctly"""
#     env_vars = {
#         "OPENAI_API_KEY": os.getenv("OPENAI_API_KEY", "NOT SET"),
#         "DATABASE_URL": os.getenv("DATABASE_URL", "NOT SET"),
#         "ALLOWED_ORIGINS": os.getenv("ALLOWED_ORIGINS", "NOT SET"),
#     }
    
#     # Check if keys are properly loaded
#     api_key = env_vars["OPENAI_API_KEY"]
#     api_key_status = "SET" if api_key != "NOT SET" and len(api_key) > 10 else "INVALID/NOT SET"
    
#     return {
#         "environment_variables": env_vars,
#         "status": {
#             "openai_api_key": api_key_status,
#             "database_url": "SET" if env_vars["DATABASE_URL"] != "NOT SET" else "NOT SET",
#             "server_running": True
#         },
#         "chromadb_working": True,  # ChromaDB is working based on your logs
#         "notes": "ChromaDB is working (based on logs). OpenAI needs API key."
#     }   

# @app.get("/debug/contracts")
# async def debug_contracts(db: Session = Depends(get_db)):
#     """Debug endpoint to check contract data"""
#     from sqlalchemy import inspect
    
#     contracts = db.query(models.Contract).all()
    
#     result = []
#     for contract in contracts:
#         inspector = inspect(contract)
        
#         # Get all column values
#         contract_data = {}
#         for column in inspector.mapper.columns:
#             value = getattr(contract, column.key)
#             contract_data[column.key] = {
#                 'value': value,
#                 'type': type(value).__name__,
#                 'is_json': isinstance(value, (dict, list))
#             }
        
#         result.append({
#             'id': contract.id,
#             'contract_type': contract.contract_type,
#             'parties': contract.parties,
#             'total_value': contract.total_value,
#             'signatories': contract.signatories,
#             'all_fields': contract_data
#         })
    
#     return {
#         'total_contracts': len(contracts),
#         'contracts': result
#     }

# @app.get("/debug/contract/{contract_id}")
# async def debug_contract(contract_id: int, db: Session = Depends(get_db)):
#     """Debug endpoint to check specific contract"""
#     contract = db.query(models.Contract).filter(models.Contract.id == contract_id).first()
    
#     if not contract:
#         return {"error": f"Contract {contract_id} not found"}
    
#     # Convert to dict with all fields
#     contract_dict = {}
#     for column in contract.__table__.columns:
#         value = getattr(contract, column.name)
#         contract_dict[column.name] = {
#             'value': value,
#             'type': type(value).__name__,
#             'is_json': isinstance(value, (dict, list))
#         }
    
#     # Check if it has extracted_tables_data
#     has_tables = bool(contract.extracted_tables_data)
#     tables_count = 0
#     if has_tables:
#         if isinstance(contract.extracted_tables_data, dict):
#             tables_count = len(contract.extracted_tables_data.get('tables', []))
#         elif isinstance(contract.extracted_tables_data, str):
#             try:
#                 tables_data = json.loads(contract.extracted_tables_data)
#                 tables_count = len(tables_data.get('tables', []))
#             except:
#                 tables_count = 0
    
#     return {
#         'contract_id': contract.id,
#         'contract_type': contract.contract_type,
#         'parties': contract.parties,
#         'total_value': contract.total_value,
#         'has_tables': has_tables,
#         'tables_count': tables_count,
#         'document_id': contract.document_id,
#         'version': contract.version,
#         'all_fields': contract_dict
#     } 

# @app.post("/documents/upload", response_model=schemas.DocumentResponse)
# async def upload_document(
#     file: UploadFile = File(...),
#     metadata: str = Form("{}"),
#     db: Session = Depends(get_db)
# ):
#     """Upload document with enhanced amendment handling"""
#     try:
#         # Validate file
#         if not file.filename:
#             raise HTTPException(status_code=400, detail="No file provided")
        
#         # Read file content
#         file_content = await file.read()
#         if len(file_content) == 0:
#             raise HTTPException(status_code=400, detail="Empty file")
        
#         # Parse metadata
#         try:
#             metadata_dict = json.loads(metadata)
#         except json.JSONDecodeError:
#             metadata_dict = {}
        
#         print(f"Uploading file: {file.filename}, metadata: {metadata_dict}")
        
#         # Process document
#         result = contract_processor.process_contract(file_content, metadata_dict)
        
#         # Save to database
#         document = models.Document(
#             filename=file.filename,
#             file_type=file.content_type,
#             file_size=len(file_content),
#             is_amendment=metadata_dict.get('is_amendment', False),
#             parent_document_id=metadata_dict.get('parent_document_id'),
#             amendment_type=metadata_dict.get('amendment_type'),
#             status="uploaded"
#         )
        
#         db.add(document)
#         db.commit()
#         db.refresh(document)
        
#         # Create contract entry
#         contract = create_contract_from_extraction(result, document.id, db)
#         db.add(contract)
#         db.commit()
#         db.refresh(contract)
        
#         # Initialize response data
#         response_data = {
#             "id": document.id,
#             "filename": document.filename,
#             "file_type": document.file_type,
#             "file_size": document.file_size,
#             "upload_date": document.upload_date,
#             "status": document.status,
#             "version": document.version,
#             "is_amendment": document.is_amendment,
#             "parent_document_id": document.parent_document_id,
#             "amendment_type": document.amendment_type,
#             "contract_id": contract.id,
#             "amendment_applied": False,
#             "parent_updated": False,
#             "new_parent_version": None
#         }
        
#         # NEW: If this is an amendment, auto-apply to parent contract
#         if metadata_dict.get('is_amendment') and metadata_dict.get('parent_document_id'):
#             try:
#                 print(f"Processing as amendment for parent document: {metadata_dict['parent_document_id']}")
                
#                 # Get parent document
#                 parent_doc = db.query(models.Document).filter(
#                     models.Document.id == metadata_dict['parent_document_id']
#                 ).first()
                
#                 if parent_doc:
#                     print(f"Found parent document: {parent_doc.filename}")
                    
#                     # Get latest version of parent contract
#                     parent_contract = db.query(models.Contract).filter(
#                         models.Contract.document_id == parent_doc.id
#                     ).order_by(models.Contract.version.desc()).first()
                    
#                     if parent_contract:
#                         print(f"Found parent contract v{parent_contract.version}: {parent_contract.contract_type}")
                        
#                         # Create updated version of parent contract
#                         updated_parent = apply_contract_amendment(parent_contract, contract)
#                         updated_parent.previous_version_id = parent_contract.id
#                         updated_parent.version = parent_contract.version + 1
#                         updated_parent.change_summary = f"Auto-amended by {file.filename} ({metadata_dict.get('amendment_type', 'modification')})"
                        
#                         # Set document_id to parent's document_id (same document, new contract version)
#                         updated_parent.document_id = parent_contract.document_id
                        
#                         # Add to database
#                         db.add(updated_parent)
                        
#                         # Create amendment relationship
#                         from app.models import ContractAmendment
#                         amendment_rel = ContractAmendment(
#                             parent_contract_id=parent_contract.id,
#                             amendment_contract_id=contract.id,
#                             applied_date=datetime.now(),
#                             changes_applied=json.dumps({
#                                 "summary": updated_parent.change_summary,
#                                 "amendment_type": metadata_dict.get('amendment_type'),
#                                 "changes": {
#                                     "total_value": {
#                                         "old": parent_contract.total_value,
#                                         "new": updated_parent.total_value
#                                     } if parent_contract.total_value != updated_parent.total_value else None,
#                                     "expiration_date": {
#                                         "old": parent_contract.expiration_date.isoformat() if parent_contract.expiration_date else None,
#                                         "new": updated_parent.expiration_date.isoformat() if updated_parent.expiration_date else None
#                                     } if parent_contract.expiration_date != updated_parent.expiration_date else None
#                                 }
#                             }),
#                             version_created=updated_parent.version
#                         )
#                         db.add(amendment_rel)
                        
#                         db.commit()
#                         db.refresh(updated_parent)
                        
#                         print(f"Created new parent contract version: v{updated_parent.version}")
                        
#                         # Update response with amendment info
#                         response_data["amendment_applied"] = True
#                         response_data["parent_updated"] = True
#                         response_data["new_parent_version"] = updated_parent.version
#                         response_data["new_parent_contract_id"] = updated_parent.id
                        
#                         # Also update the amendment contract to reference the new parent version
#                         contract.previous_version_id = parent_contract.id
#                         db.commit()
                        
#                         print(f"Amendment successfully applied. Parent updated to v{updated_parent.version}")
                        
#                     else:
#                         print(f"No parent contract found for document {parent_doc.id}")
#                 else:
#                     print(f"Parent document {metadata_dict['parent_document_id']} not found")
                    
#             except Exception as amendment_error:
#                 print(f"Auto-amendment failed (non-critical): {amendment_error}")
#                 import traceback
#                 traceback.print_exc()
#                 # Continue without failing the upload
#                 response_data["amendment_error"] = str(amendment_error)
        
#         # Create embeddings for RAG
#         try:
#             from app.agents.enhanced_rag_engine import EnhancedRAGEngine
#             rag_engine = EnhancedRAGEngine()
            
#             # Extract text for embeddings
#             text_result = contract_processor.extract_text_from_pdf(file_content)
#             plain_text = text_result.get("text", "")
            
#             if plain_text:
#                 # Create embeddings in ChromaDB
#                 embeddings = rag_engine.create_embeddings(
#                     plain_text, 
#                     contract.id, 
#                     contract.version
#                 )
#                 print(f"Created {len(embeddings)} embeddings for contract {contract.id}")
                
#                 # Save to database as well
#                 for embedding_data in embeddings:
#                     rag_embedding = models.RAGEmbedding(
#                         contract_id=contract.id,
#                         text_chunk=embedding_data.get("text"),
#                         chunk_metadata=embedding_data.get("metadata"),
#                         chroma_chunk_id=embedding_data.get("chunk_id"),
#                         vector_db_type="chromadb"
#                     )
#                     db.add(rag_embedding)
                
#                 db.commit()
#         except Exception as e:
#             print(f"Error creating embeddings (non-critical): {e}")
        
#         print(f"Document upload complete: {file.filename} (ID: {document.id})")
#         return response_data
        
#     except Exception as e:
#         db.rollback()
#         print(f"Error uploading document: {e}")
#         import traceback
#         traceback.print_exc()
#         raise HTTPException(status_code=500, detail=f"Error uploading document: {str(e)}")    


#     def process_document_async(document_id: int, file_content: bytes, db: Session, 
#                             is_amendment: bool = False, parent_document_id: Optional[int] = None):
#         """Enhanced async processing with table extraction"""
#         try:
#             print(f"Starting enhanced async processing for document {document_id}")
            
#             from app.database import SessionLocal
#             local_db = SessionLocal()
            
#             try:
#                 # Update document status
#                 document = local_db.query(models.Document)\
#                     .filter(models.Document.id == document_id)\
#                     .first()
                
#                 if not document:
#                     print(f"Document {document_id} not found")
#                     return
                    
#                 document.status = "processing"
#                 local_db.commit()
                
#                 # Initialize processors
#                 print(f"Initializing processors for document {document_id}")
#                 processor = ContractProcessor()
                
#                 # Process contract with enhanced extraction
#                 print(f"Processing contract with table extraction")
#                 extraction = processor.process_contract(file_content, {
#                     "document_id": document_id,
#                     "filename": document.filename,
#                     "is_amendment": is_amendment
#                 })
                
#                 print(f"Extraction completed, confidence: {extraction.get('confidence_score')}")
                
#                 # Handle versioning if this is an amendment
#                 previous_contract = None
#                 version = 1
                
#                 if is_amendment and parent_document_id:
#                     # Find the latest version of the parent contract
#                     parent_doc = local_db.query(models.Document)\
#                         .filter(models.Document.id == parent_document_id)\
#                         .first()
                    
#                     if parent_doc:
#                         previous_contract = local_db.query(models.Contract)\
#                             .filter(models.Contract.document_id == parent_doc.id)\
#                             .order_by(models.Contract.version.desc())\
#                             .first()
                        
#                         if previous_contract:
#                             version = previous_contract.version + 1
                            
#                 # Extract text for embeddings
#                 text_result = processor.extract_text_from_pdf(file_content)
#                 plain_text = text_result.get("text", "")
                
#                 # Fix the signatories extraction
#                 signatories_list = []
#                 contacts_list = []
                
#                 # Extract from multiple possible locations
#                 if extraction.get("contact_information"):
#                     if extraction["contact_information"].get("signatories"):
#                         signatories_list = extraction["contact_information"]["signatories"]
#                     if extraction["contact_information"].get("administrative_contacts"):
#                         contacts_list = extraction["contact_information"]["administrative_contacts"]
                
#                 if extraction.get("signatories"):
#                     signatories_list = extraction["signatories"]
                
#                 if extraction.get("contacts"):
#                     contacts_list = extraction["contacts"]
                
#                 # Helper function to extract risk factors
#                 def extract_risk_factors(extraction_data):
#                     """Extract risk factors from the extraction result"""
#                     risk_factors = []
                    
#                     # Check for high risk indicators
#                     risk_indicators = extraction_data.get("risk_indicators", {})
                    
#                     if risk_indicators.get("auto_renewal"):
#                         risk_factors.append({
#                             "factor": "Auto Renewal",
#                             "severity": "medium",
#                             "mitigation": "Set calendar reminder before renewal period",
#                             "confidence": 0.9
#                         })
                    
#                     if risk_indicators.get("unlimited_liability"):
#                         risk_factors.append({
#                             "factor": "Unlimited Liability",
#                             "severity": "high",
#                             "mitigation": "Negotiate liability cap",
#                             "confidence": 0.8
#                         })
                    
#                     # Add risk based on contract value
#                     financial = extraction_data.get("financial", {})
#                     if financial.get("total_value", 0) > 1000000:
#                         risk_factors.append({
#                             "factor": "High Contract Value",
#                             "severity": "high" if financial.get("total_value", 0) > 5000000 else "medium",
#                             "mitigation": "Additional review required",
#                             "confidence": 1.0
#                         })
                    
#                     # Add risk based on expiration
#                     dates = extraction_data.get("dates", {})
#                     if dates.get("expiration_date"):
#                         try:
#                             exp_date = datetime.fromisoformat(dates["expiration_date"].replace('Z', '+00:00'))
#                             days_remaining = (exp_date - datetime.now()).days
#                             if days_remaining < 90:
#                                 risk_factors.append({
#                                     "factor": "Contract Expiring Soon",
#                                     "severity": "high" if days_remaining < 30 else "medium",
#                                     "mitigation": "Initiate renewal process",
#                                     "confidence": 1.0
#                                 })
#                         except:
#                             pass
                    
#                     return risk_factors
                
#                 # Get risk factors
#                 risk_factors_list = extract_risk_factors(extraction)
                
#                 # Helper function to clean date values
#                 def clean_date(date_value):
#                     """Convert empty strings to None for date fields"""
#                     if not date_value or date_value == "" or date_value == "Unknown":
#                         return None
#                     return date_value

#                 # Save contract with all extracted fields
#                 # Save contract with all extracted fields
#                 # Save contract with all extracted fields
#                 # contract_data = {
#                 #     "document_id": document_id,
#                 #     "contract_type": extraction.get("contract_type", "Unknown"),
#                 #     "contract_subtype": extraction.get("contract_subtype"),
#                 #     "master_agreement_id": extraction.get("master_agreement_id"),
#                 #     "parties": extraction.get("parties", []),
#                 #     "effective_date": clean_date(extraction.get("dates", {}).get("effective_date")),
#                 #     "expiration_date": clean_date(extraction.get("dates", {}).get("expiration_date")),
#                 #     "execution_date": clean_date(extraction.get("dates", {}).get("execution_date")),
#                 #     "termination_date": clean_date(extraction.get("dates", {}).get("termination_date")),
#                 #     "total_value": extraction.get("financial", {}).get("total_value"),
#                 #     "currency": extraction.get("financial", {}).get("currency"),
#                 #     "payment_terms": extraction.get("financial", {}).get("payment_terms"),
#                 #     "billing_frequency": extraction.get("financial", {}).get("billing_frequency"),
#                 #     "signatories": signatories_list,
#                 #     "contacts": contacts_list,
#                 #     "auto_renewal": extraction.get("risk_indicators", {}).get("auto_renewal"),
#                 #     "renewal_notice_period": extraction.get("dates", {}).get("notice_period_days"),
#                 #     "termination_notice_period": extraction.get("dates", {}).get("notice_period_days"),
#                 #     "governing_law": extraction.get("key_fields", {}).get("governing_law", {}).get("value") if extraction.get("key_fields", {}).get("governing_law") else None,
#                 #     "jurisdiction": extraction.get("key_fields", {}).get("governing_law", {}).get("value") if extraction.get("key_fields", {}).get("governing_law") else None,
#                 #     "confidentiality": extraction.get("clauses", {}).get("confidentiality") is not None,
#                 #     "indemnification": extraction.get("clauses", {}).get("indemnification") is not None,
#                 #     "liability_cap": extraction.get("key_fields", {}).get("liability_cap", {}).get("value") if extraction.get("key_fields", {}).get("liability_cap") else None,
#                 #     "insurance_requirements": extraction.get("compliance_requirements", {}).get("minimum_coverage"),
#                 #     "service_levels": extraction.get("service_levels", {}),
#                 #     "deliverables": extraction.get("deliverables", []),
#                 #     "risk_score": extraction.get("risk_score", 0.0),
#                 #     "risk_factors": risk_factors_list,
#                 #     "clauses": extraction.get("clauses", {}),
#                 #     "key_fields": extraction.get("key_fields", {}),
#                 #     "extracted_metadata": extraction.get("metadata", {}),
#                 #     "confidence_score": extraction.get("confidence_score", 0.0),
#                 #     "version": version,
#                 #     "previous_version_id": previous_contract.id if previous_contract else None,
#                 #     "change_summary": f"Amendment detected with {len(extraction.get('clauses', {}))} clauses" if is_amendment else "Initial extraction",
#                 #     "needs_review": True,
#                 # }

#                 # # Create contract without extracted_tables_data field
#                 # contract = models.Contract(**contract_data)

#                 # local_db.add(contract)
#                 # local_db.commit()
#                 # local_db.refresh(contract)

#                 # print(f"Contract saved with ID: {contract.id}, Version: {version}")

#                 deliverables_cleaned = clean_json_for_db(extraction.get("deliverables", []))
#                 extracted_tables_cleaned = clean_json_for_db(extraction.get("extracted_tables", {}))
#                 clauses_cleaned = clean_json_for_db(extraction.get("clauses", {}))
#                 key_fields_cleaned = clean_json_for_db(extraction.get("key_fields", {}))
#                 metadata_cleaned = clean_json_for_db(extraction.get("metadata", {}))
#                 risk_factors_cleaned = clean_json_for_db(risk_factors_list)
#                 signatories_cleaned = clean_json_for_db(signatories_list)
#                 contacts_cleaned = clean_json_for_db(contacts_list)
#                 parties_cleaned = clean_json_for_db(extraction.get("parties", []))
#                 service_levels_cleaned = clean_json_for_db(extraction.get("service_levels", {}))


#                 contract_data = {
#                 "document_id": document_id,
#                 "contract_type": extraction.get("contract_type", "Unknown"),
#                 "contract_subtype": extraction.get("contract_subtype"),
#                 "master_agreement_id": extraction.get("master_agreement_id"),
#                 "parties": parties_cleaned,
#                 "effective_date": clean_date(extraction.get("dates", {}).get("effective_date")),
#                 "expiration_date": clean_date(extraction.get("dates", {}).get("expiration_date")),
#                 "execution_date": clean_date(extraction.get("dates", {}).get("execution_date")),
#                 "termination_date": clean_date(extraction.get("dates", {}).get("termination_date")),
#                 "total_value": extraction.get("financial", {}).get("total_value"),
#                 "currency": extraction.get("financial", {}).get("currency"),
#                 "payment_terms": extraction.get("financial", {}).get("payment_terms"),
#                 "billing_frequency": extraction.get("financial", {}).get("billing_frequency"),
#                 "signatories": signatories_cleaned,
#                 "contacts": contacts_cleaned,
#                 "auto_renewal": extraction.get("risk_indicators", {}).get("auto_renewal"),
#                 "renewal_notice_period": extraction.get("dates", {}).get("notice_period_days"),
#                 "termination_notice_period": extraction.get("dates", {}).get("notice_period_days"),
#                 "governing_law": extraction.get("key_fields", {}).get("governing_law", {}).get("value") if extraction.get("key_fields", {}).get("governing_law") else None,
#                 "jurisdiction": extraction.get("key_fields", {}).get("governing_law", {}).get("value") if extraction.get("key_fields", {}).get("governing_law") else None,
#                 "confidentiality": extraction.get("clauses", {}).get("confidentiality") is not None,
#                 "indemnification": extraction.get("clauses", {}).get("indemnification") is not None,
#                 "liability_cap": extraction.get("key_fields", {}).get("liability_cap", {}).get("value") if extraction.get("key_fields", {}).get("liability_cap") else None,
#                 "insurance_requirements": extraction.get("compliance_requirements", {}).get("minimum_coverage"),
#                 "service_levels": service_levels_cleaned,
#                 "deliverables": deliverables_cleaned,
#                 "risk_score": extraction.get("risk_score", 0.0),
#                 "risk_factors": risk_factors_cleaned,
#                 "clauses": clauses_cleaned,
#                 "key_fields": key_fields_cleaned,
#                 "extracted_metadata": metadata_cleaned,
#                 "extracted_tables_data": extracted_tables_cleaned,
#                 "confidence_score": extraction.get("confidence_score", 0.0),
#                 "version": version,
#                 "previous_version_id": previous_contract.id if previous_contract else None,
#                 "change_summary": f"Amendment detected with {len(extraction.get('clauses', {}))} clauses" if is_amendment else "Initial extraction",
#                 "needs_review": True,
#             }

#                 # contract_data = {
#                 #     "document_id": document_id,
#                 #     "contract_type": extraction.get("contract_type", "Unknown"),
#                 #     "contract_subtype": extraction.get("contract_subtype"),
#                 #     "master_agreement_id": extraction.get("master_agreement_id"),
#                 #     "parties": extraction.get("parties", []),
#                 #     "effective_date": clean_date(extraction.get("dates", {}).get("effective_date")),
#                 #     "expiration_date": clean_date(extraction.get("dates", {}).get("expiration_date")),
#                 #     "execution_date": clean_date(extraction.get("dates", {}).get("execution_date")),
#                 #     "termination_date": clean_date(extraction.get("dates", {}).get("termination_date")),
#                 #     "total_value": extraction.get("financial", {}).get("total_value"),
#                 #     "currency": extraction.get("financial", {}).get("currency"),
#                 #     "payment_terms": extraction.get("financial", {}).get("payment_terms"),
#                 #     "billing_frequency": extraction.get("financial", {}).get("billing_frequency"),
#                 #     "signatories": signatories_list,
#                 #     "contacts": contacts_list,
#                 #     "auto_renewal": extraction.get("risk_indicators", {}).get("auto_renewal"),
#                 #     "renewal_notice_period": extraction.get("dates", {}).get("notice_period_days"),
#                 #     "termination_notice_period": extraction.get("dates", {}).get("notice_period_days"),
#                 #     "governing_law": extraction.get("key_fields", {}).get("governing_law", {}).get("value") if extraction.get("key_fields", {}).get("governing_law") else None,
#                 #     "jurisdiction": extraction.get("key_fields", {}).get("governing_law", {}).get("value") if extraction.get("key_fields", {}).get("governing_law") else None,
#                 #     "confidentiality": extraction.get("clauses", {}).get("confidentiality") is not None,
#                 #     "indemnification": extraction.get("clauses", {}).get("indemnification") is not None,
#                 #     "liability_cap": extraction.get("key_fields", {}).get("liability_cap", {}).get("value") if extraction.get("key_fields", {}).get("liability_cap") else None,
#                 #     "insurance_requirements": extraction.get("compliance_requirements", {}).get("minimum_coverage"),
#                 #     "service_levels": extraction.get("service_levels", {}),
#                 #     "deliverables": extraction.get("deliverables", []),
#                 #     "risk_score": extraction.get("risk_score", 0.0),
#                 #     "risk_factors": risk_factors_list,
#                 #     "clauses": extraction.get("clauses", {}),
#                 #     "key_fields": extraction.get("key_fields", {}),
#                 #     "extracted_metadata": extraction.get("metadata", {}),
#                 #     "extracted_tables_data": extraction.get("extracted_tables", {}),  # Add this line
#                 #     "confidence_score": extraction.get("confidence_score", 0.0),
#                 #     "version": version,
#                 #     "previous_version_id": previous_contract.id if previous_contract else None,
#                 #     "change_summary": f"Amendment detected with {len(extraction.get('clauses', {}))} clauses" if is_amendment else "Initial extraction",
#                 #     "needs_review": True,
#                 # }

#                 # Create contract
#                 contract = models.Contract(**contract_data)
#                 local_db.add(contract)
#                 local_db.commit()
#                 local_db.refresh(contract)

#                 print(f"Contract saved with ID: {contract.id}, Version: {version}")
#                 print(f"Extracted tables count: {len(extraction.get('extracted_tables', {}).get('tables', [])) if extraction.get('extracted_tables') else 0}")

#                 # Store extracted tables in a separate field if it exists
#                 try:
#                     if hasattr(contract, 'extracted_tables_data'):
#                         contract.extracted_tables_data = extraction.get("extracted_tables", {})
#                         local_db.commit()
#                         print(f"Extracted tables data stored for contract {contract.id}")
#                 except Exception as e:
#                     print(f"Note: Could not store extracted tables data: {e}")
                
#                 # Create embeddings for RAG using EnhancedRAGEngine
#                 print(f"Creating embeddings for contract {contract.id} using ChromaDB")
#                 if plain_text:
#                     enhanced_rag = EnhancedRAGEngine()
#                     embeddings = enhanced_rag.create_embeddings(plain_text, contract.id, version)
#                     print(f"Created {len(embeddings)} embeddings in ChromaDB")
                    
#                     # Store minimal reference in PostgreSQL
#                     for emb in embeddings:
#                         rag_emb = models.RAGEmbedding(
#                             contract_id=contract.id,
#                             text_chunk=emb["text_chunk"],
#                             embedding={},  # Empty since we're using ChromaDB
#                             chunk_metadata=emb["chunk_metadata"],
#                             chroma_chunk_id=emb.get("chunk_id"),
#                             vector_db_type="chromadb",
#                             version=version
#                         )
#                         local_db.add(rag_emb)
                    
#                     local_db.commit()
#                     print(f"Saved {len(embeddings)} embedding references to PostgreSQL")
#                 else:
#                     print("No text available for embeddings")
                
#                 # Update document status
#                 document.status = "completed"
#                 document.version = version
#                 local_db.commit()
                
#                 print(f"Document {document_id} processing completed successfully")
                
#             except Exception as e:
#                 print(f"Error processing document {document_id}: {str(e)}")
#                 import traceback
#                 traceback.print_exc()
                
#                 # Update document status to failed
#                 try:
#                     document = local_db.query(models.Document)\
#                         .filter(models.Document.id == document_id)\
#                         .first()
#                     if document:
#                         document.status = f"failed: {str(e)[:100]}"
#                         document.last_processing_error = str(e)
#                         document.processing_attempts = (document.processing_attempts or 0) + 1
#                         local_db.commit()
#                 except:
#                     pass
#             finally:
#                 local_db.close()
                
#         except Exception as e:
#             print(f"Outer error in async processing: {str(e)}")
#             import traceback
#             traceback.print_exc()
    

