import openai
import os
from typing import Dict, Any, List, Tuple
import json
import PyPDF2
import re
from io import BytesIO
from openai import OpenAI
from datetime import datetime

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

class ContractProcessor:
    def __init__(self):
        self.system_prompt = """You are an Enterprise Contract Intelligence Agent. Extract ALL structured information from contracts.
        Return ONLY valid JSON with this EXACT structure:
        {
            "contract_type": "type of contract (e.g., 'NDA', 'Service Agreement', 'Master Agreement')",
            "contract_subtype": "subtype if applicable",
            "master_agreement_id": "reference number if exists",
            "parties": ["full legal name of party1", "full legal name of party2"],
            "dates": {
                "effective_date": "YYYY-MM-DD or null",
                "expiration_date": "YYYY-MM-DD or null",
                "execution_date": "YYYY-MM-DD or null",
                "termination_date": "YYYY-MM-DD or null"
            },
            "financial": {
                "total_value": number or null,
                "currency": "ISO code",
                "payment_terms": "terms description",
                "billing_frequency": "frequency description"
            },
            "signatories": [
                {
                    "name": "full name",
                    "title": "job title",
                    "email": "email if available"
                }
            ],
            "contacts": [
                {
                    "type": "legal/technical/billing",
                    "name": "contact name",
                    "email": "email if available",
                    "phone": "phone if available"
                }
            ],
            "legal_terms": {
                "auto_renewal": boolean,
                "renewal_notice_period": number_in_days,
                "termination_notice_period": number_in_days,
                "governing_law": "jurisdiction",
                "jurisdiction": "specific jurisdiction",
                "confidentiality": boolean,
                "indemnification": boolean,
                "liability_cap": "cap amount and currency",
                "insurance_requirements": "requirements description"
            },
            "service_levels": {
                "kpi_name": {
                    "target": "target value",
                    "measurement_period": "period description",
                    "remedies": "remedy description"
                }
            },
            "deliverables": [
                {
                    "item": "deliverable name",
                    "due_date": "YYYY-MM-DD or null",
                    "milestone": "milestone description"
                }
            ],
            "risk_factors": [
                {
                    "factor": "risk description",
                    "severity": "low/medium/high/critical",
                    "mitigation": "mitigation strategy"
                }
            ],
            "clauses": {
                "clause_name": {
                    "text": "full extracted text",
                    "category": "category",
                    "confidence": 0.95,
                    "risk_level": "low/medium/high"
                }
            },
            "key_fields": {
                "field_name": {
                    "value": "extracted value",
                    "data_type": "string/number/date/boolean",
                    "confidence": 0.95,
                    "source_page": page_number
                }
            },
            "metadata": {
                "page_count": number,
                "language": "detected language",
                "has_signatures": boolean,
                "has_schedules": boolean,
                "document_completeness": 0.95
            },
            "confidence_score": 0.95
        }
        
        IMPORTANT: Extract EVERY detail you find. If something is mentioned multiple times, take the most specific/clear instance.
        For dates, always format as YYYY-MM-DD.
        For financial amounts, extract both number and currency.
        For parties, extract FULL legal names, not abbreviations."""
    
    def extract_text_from_pdf(self, file_content: bytes) -> str:
        """Extract text from PDF file - FIXED VERSION"""
        text = ""
        try:
            pdf_file = BytesIO(file_content)
            pdf_reader = PyPDF2.PdfReader(pdf_file)
            
            for page_num in range(len(pdf_reader.pages)):
                page = pdf_reader.pages[page_num]
                text += page.extract_text() + "\n"
                
        except Exception as e:
            print(f"Error extracting text from PDF: {e}")
            
        return text
    
    def _detect_tables(self, text: str) -> bool:
        """Detect if text contains table-like structures"""
        # Simple table detection
        lines = text.split('\n')
        table_patterns = ['|', '\t', '  ', '    ']
        for line in lines:
            if any(pattern in line for pattern in table_patterns):
                return True
        return False
    
    def _detect_signatures(self, text: str) -> bool:
        """Detect signature-related text"""
        signature_keywords = ['signature', 'signed', 'executed', 'witness', 'notary']
        text_lower = text.lower()
        return any(keyword in text_lower for keyword in signature_keywords)
    
    def process_contract(self, text: str, metadata: Dict[str, Any] = None) -> Dict[str, Any]:
        """Process contract text using OpenAI with enhanced extraction"""
        try:
            # Prepare enhanced context
            context = f"""
            Document Metadata:
            - Pages: {metadata.get('page_count', 'Unknown') if metadata else 'Unknown'}
            - Extraction Quality: {'High' if len(text) > 1000 else 'Low'}
            
            Contract Text:
            {text[:20000]}  # Increased limit for detailed extraction
            """
            
            response = client.chat.completions.create(
                model="gpt-4-turbo-preview",
                messages=[
                    {"role": "system", "content": self.system_prompt},
                    {"role": "user", "content": context}
                ],
                temperature=0.1,
                max_tokens=4000,
                response_format={"type": "json_object"}
            )
            
            result = json.loads(response.choices[0].message.content)
            
            # Calculate risk score based on extracted factors
            result["risk_score"] = self._calculate_risk_score(result)
            
            # Add metadata
            if metadata:
                result["metadata"] = {**result.get("metadata", {}), **metadata}
            
            return result
            
        except Exception as e:
            print(f"Error processing contract: {e}")
            return self._get_fallback_extraction()
    
    def _calculate_risk_score(self, extraction: Dict[str, Any]) -> float:
        """Calculate risk score based on extracted factors"""
        risk_score = 0.0
        
        # Check for high-risk clauses
        if extraction.get("clauses"):
            high_risk_clauses = ["indemnification", "liability", "termination", "penalty"]
            for clause in extraction["clauses"]:
                if any(risk_term in clause.lower() for risk_term in high_risk_clauses):
                    risk_score += 0.1
        
        # Check dates
        dates = extraction.get("dates", {})
        if dates.get("expiration_date"):
            exp_date = datetime.fromisoformat(dates["expiration_date"].replace('Z', '+00:00'))
            days_remaining = (exp_date - datetime.now()).days
            if days_remaining < 90:  # Expiring soon
                risk_score += 0.2
            if days_remaining < 30:  # Expiring very soon
                risk_score += 0.3
        
        # Check financial terms
        financial = extraction.get("financial", {})
        if financial.get("total_value", 0) > 1000000:  # High value contract
            risk_score += 0.15
        
        # Normalize to 0-1
        return min(risk_score, 1.0)
    
    def _get_fallback_extraction(self) -> Dict[str, Any]:
        """Return structured fallback extraction"""
        return {
            "contract_type": "Unknown",
            "contract_subtype": None,
            "master_agreement_id": None,
            "parties": [],
            "dates": {},
            "financial": {},
            "signatories": [],
            "contacts": [],
            "legal_terms": {},
            "service_levels": {},
            "deliverables": [],
            "risk_factors": [],
            "clauses": {},
            "key_fields": {},
            "metadata": {},
            "confidence_score": 0.0,
            "risk_score": 0.0
        }
    
    def compare_versions(self, old_extraction: Dict[str, Any], new_extraction: Dict[str, Any]) -> Dict[str, Any]:
        """Compare two contract versions and identify changes"""
        deltas = []
        
        # Compare key fields
        for field in ["parties", "dates", "financial"]:
            old_val = old_extraction.get(field, {})
            new_val = new_extraction.get(field, {})
            
            if old_val != new_val:
                if isinstance(old_val, dict) and isinstance(new_val, dict):
                    for subfield in set(old_val.keys()) | set(new_val.keys()):
                        if old_val.get(subfield) != new_val.get(subfield):
                            deltas.append({
                                "field_name": f"{field}.{subfield}",
                                "old_value": old_val.get(subfield),
                                "new_value": new_val.get(subfield),
                                "change_type": "modified" if subfield in old_val and subfield in new_val else "added" if subfield in new_val else "removed"
                            })
                else:
                    deltas.append({
                        "field_name": field,
                        "old_value": old_val,
                        "new_value": new_val,
                        "change_type": "modified"
                    })
        
        # Compare clauses
        old_clauses = set(old_extraction.get("clauses", {}).keys())
        new_clauses = set(new_extraction.get("clauses", {}).keys())
        
        for clause in old_clauses - new_clauses:
            deltas.append({
                "field_name": f"clauses.{clause}",
                "old_value": old_extraction["clauses"][clause],
                "new_value": None,
                "change_type": "removed"
            })
        
        for clause in new_clauses - old_clauses:
            deltas.append({
                "field_name": f"clauses.{clause}",
                "old_value": None,
                "new_value": new_extraction["clauses"][clause],
                "change_type": "added"
            })
        
        for clause in old_clauses & new_clauses:
            if old_extraction["clauses"][clause] != new_extraction["clauses"][clause]:
                deltas.append({
                    "field_name": f"clauses.{clause}",
                    "old_value": old_extraction["clauses"][clause],
                    "new_value": new_extraction["clauses"][clause],
                    "change_type": "modified"
                })
        
        return {
            "deltas": deltas,
            "summary": f"Found {len(deltas)} changes between versions",
            "confidence_change": new_extraction.get("confidence_score", 0) - old_extraction.get("confidence_score", 0)
        }