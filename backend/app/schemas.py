from pydantic import BaseModel
from typing import Optional, Dict, Any, List
from datetime import datetime

class DocumentUpload(BaseModel):
    filename: str
    file_type: str
    file_size: int

class DocumentResponse(DocumentUpload):
    id: int
    upload_date: datetime
    status: str
    
class ContractCreate(BaseModel):
    document_id: int
    contract_type: str
    parties: List[str]
    effective_date: Optional[datetime] = None
    expiration_date: Optional[datetime] = None
    total_value: Optional[float] = None
    currency: Optional[str] = None
    clauses: Dict[str, Any]
    key_fields: Dict[str, Any]
    confidence_score: float
    
class ContractResponse(ContractCreate):
    id: int
    extraction_date: datetime
    needs_review: bool
    
class SearchQuery(BaseModel):
    query: str
    limit: int = 10