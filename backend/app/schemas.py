from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List, Union
from datetime import datetime
from enum import Enum

class AmendmentType(str, Enum):
    RENEWAL = "renewal"
    MODIFICATION = "modification"
    TERMINATION = "termination"
    EXTENSION = "extension"
    CORRECTION = "correction"

class Signatory(BaseModel):
    name: str
    title: str
    email: Optional[str] = None
    signature_date: Optional[datetime] = None

class Contact(BaseModel):
    type: str
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None

class RiskFactor(BaseModel):
    factor: str
    severity: str
    mitigation: Optional[str] = None
    confidence: float

class DocumentUpload(BaseModel):
    filename: str
    file_type: str
    file_size: int
    is_amendment: bool = False
    parent_document_id: Optional[int] = None
    amendment_type: Optional[AmendmentType] = None

class DocumentResponse(DocumentUpload):
    id: int
    upload_date: datetime
    status: str
    version: int
    amendment_count: Optional[int] = 0

class ContractCreate(BaseModel):
    document_id: int
    contract_type: str
    contract_subtype: Optional[str] = None
    master_agreement_id: Optional[str] = None
    parties: List[str]
    
    # Dates
    effective_date: Optional[datetime] = None
    expiration_date: Optional[datetime] = None
    execution_date: Optional[datetime] = None
    termination_date: Optional[datetime] = None
    
    # Financial
    total_value: Optional[float] = None
    currency: Optional[str] = None
    payment_terms: Optional[str] = None
    billing_frequency: Optional[str] = None
    
    # Contacts
    signatories: Optional[List[Signatory]] = None
    contacts: Optional[List[Contact]] = None
    
    # Legal & Compliance
    auto_renewal: Optional[bool] = None
    renewal_notice_period: Optional[int] = None
    termination_notice_period: Optional[int] = None
    governing_law: Optional[str] = None
    jurisdiction: Optional[str] = None
    confidentiality: Optional[bool] = None
    indemnification: Optional[bool] = None
    liability_cap: Optional[str] = None
    insurance_requirements: Optional[str] = None
    
    # Technical
    service_levels: Optional[Dict[str, Any]] = None
    deliverables: Optional[List[Dict[str, Any]]] = None
    
    # Risk
    risk_score: Optional[float] = 0.0
    risk_factors: Optional[List[RiskFactor]] = None
    
    # Content - CHANGED: metadata -> extracted_metadata
    clauses: Dict[str, Any]
    key_fields: Dict[str, Any]
    extracted_metadata: Optional[Dict[str, Any]] = None  # Changed from 'metadata'
    confidence_score: float

class ContractResponse(ContractCreate):
    id: int
    extraction_date: datetime
    needs_review: bool
    version: int
    previous_version_id: Optional[int] = None
    change_summary: Optional[str] = None
    amendment_count: Optional[int] = 0
    risk_level: Optional[str] = None
    
    class Config:
        from_attributes = True

class DeltaItem(BaseModel):
    field_name: str
    old_value: Optional[Any] = None
    new_value: Optional[Any] = None
    change_type: str
    confidence_change: Optional[float] = None

class ContractDeltaResponse(BaseModel):
    contract_id: int
    version_from: int
    version_to: int
    deltas: List[DeltaItem]
    summary: Optional[str] = None
    detected_at: datetime

class SearchQuery(BaseModel):
    query: str
    limit: int = 10
    filter_by: Optional[Dict[str, Any]] = None

class ContractSummary(BaseModel):
    total_contracts: int
    total_value: float
    expiring_soon: int
    high_risk: int
    needs_review: int
    by_type: Dict[str, int]
    by_status: Dict[str, int]

class ContractCompareRequest(BaseModel):
    contract_id_1: int
    contract_id_2: int
    compare_type: Optional[str] = "detailed"  # "quick", "detailed", "financial"    