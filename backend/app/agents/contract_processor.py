import openai
import os
from typing import Dict, Any, List
import json
import PyPDF2
from io import BytesIO
from openai import OpenAI

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

class ContractProcessor:
    def __init__(self):
        self.system_prompt = """You are a Contract Intelligence Agent. Extract structured information from contracts.
        Return ONLY valid JSON with the following structure:
        {
            "contract_type": "type of contract",
            "parties": ["party1", "party2"],
            "effective_date": "YYYY-MM-DD or null",
            "expiration_date": "YYYY-MM-DD or null",
            "total_value": number or null,
            "currency": "currency code or null",
            "clauses": {
                "clause_name": {
                    "text": "extracted text",
                    "confidence": 0.95
                }
            },
            "key_fields": {
                "field_name": {
                    "value": "extracted value",
                    "confidence": 0.95
                }
            },
            "confidence_score": 0.95
        }"""
    
    def extract_text_from_pdf(self, file_content: bytes) -> str:
        """Extract text from PDF file"""
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
    
    def process_contract(self, text: str) -> Dict[str, Any]:
        """Process contract text using OpenAI"""
        try:
            response = client.chat.completions.create(
                model="gpt-4-turbo-preview",
                messages=[
                    {"role": "system", "content": self.system_prompt},
                    {"role": "user", "content": f"Extract information from this contract:\n\n{text[:15000]}"}
                ],
                temperature=0.1,
                response_format={"type": "json_object"}
            )
            
            result = json.loads(response.choices[0].message.content)
            return result
            
        except Exception as e:
            print(f"Error processing contract: {e}")
            return {
                "contract_type": "Unknown",
                "parties": [],
                "clauses": {},
                "key_fields": {},
                "confidence_score": 0.0
            }
    
    def validate_extraction(self, extraction: Dict[str, Any]) -> Dict[str, Any]:
        """Validate and score extraction quality"""
        # Simple validation logic
        confidence = extraction.get("confidence_score", 0.0)
        
        # Add validation flags
        validation = {
            "has_parties": len(extraction.get("parties", [])) >= 2,
            "has_dates": bool(extraction.get("effective_date")),
            "has_clauses": len(extraction.get("clauses", {})) > 0,
            "overall_confidence": confidence
        }
        
        return validation