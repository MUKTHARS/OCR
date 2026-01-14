import openai
import os
from typing import Dict, Any, List, Optional
import json
import PyPDF2
import re
from io import BytesIO
from openai import OpenAI
from datetime import datetime
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity

# Add imports at the top
from .table_extractor import TableExtractor
import hashlib

class ContractProcessor:
    def __init__(self):
        # Initialize table extractor
        self.table_extractor = TableExtractor()
        
        # Update system prompt to be more specific about table handling
        self.system_prompt = """You are an Enterprise Contract Intelligence Agent. Extract ALL information from contracts.

        IMPORTANT: 
        1. Pay special attention to tables - they contain critical information
        2. Tables have already been extracted separately and will be provided to you
        3. Focus on interpreting and structuring the table data
        4. For payment schedules, deliverables, reporting requirements, etc., use the provided table data
        
        IMPORTANT EXTRACTIONS:
        1. Extract signatories with names, titles, and signatures
        2. Extract ALL parties with full legal names
        3. For each contract, ensure you extract:
           - All signatories (names, titles, signature dates)
           - Total contract value with currency
           - All parties involved
           - Contract type and subtype
           - Effective and expiration dates
        
        TABLES PROVIDED SEPARATELY:
        You will receive table data in a structured format. Use this data to populate:
        - Payment schedules
        - Deliverables
        - Budget items
        - Reporting requirements
        - Personnel assignments
        - Compliance requirements
        
        Return ONLY valid JSON with this structure:
        {
            "contract_type": "type of contract",
            "contract_subtype": "subtype if applicable",
            "master_agreement_id": "reference number",
            "parties": ["Party 1 Full Legal Name", "Party 2 Full Legal Name"],
            
            "dates": {
                "effective_date": "YYYY-MM-DD",
                "expiration_date": "YYYY-MM-DD",
                "execution_date": "YYYY-MM-DD",
                "termination_date": "YYYY-MM-DD",
                "renewal_date": "YYYY-MM-DD",
                "notice_period_days": 30
            },
            
            "financial": {
                "total_value": 100000,
                "currency": "USD",
                "payment_terms": "Net 30",
                "billing_frequency": "Monthly"
            },
            
            "tables_summary": {
                "payment_schedules_count": 1,
                "deliverables_count": 3,
                "budget_items_count": 5,
                "reporting_requirements_count": 2
            },
            
            "key_fields": {
                "contract_value": {
                    "value": "100,000 USD",
                    "source_section": "Financial Terms"
                }
            },
            
            "risk_indicators": {
                "auto_renewal": true,
                "unlimited_liability": false
            },
            
            "contact_information": {
                "signatories": [
                    {
                        "name": "John Doe",
                        "title": "CEO",
                        "email": "john@company.com"
                    }
                ]
            },
            
            "extraction_notes": [
                "Tables processed separately",
                "Payment schedule extracted from page 3"
            ]
        }
        
        IMPORTANT: 
        - When you see table data provided, incorporate it into your response
        - Mark any ambiguities or unclear sections
        - Preserve all extracted information"""
    
    def extract_text_from_pdf(self, file_content: bytes) -> Dict[str, Any]:
        """Enhanced text extraction with table detection"""
        result = {
            "text": "",
            "page_count": 0,
            "table_sections": [],
            "signature_sections": []
        }
        
        try:
            pdf_file = BytesIO(file_content)
            pdf_reader = PyPDF2.PdfReader(pdf_file)
            result["page_count"] = len(pdf_reader.pages)
            
            for page_num in range(len(pdf_reader.pages)):
                page = pdf_reader.pages[page_num]
                page_text = page.extract_text()
                
                if page_text:
                    result["text"] += f"\n--- Page {page_num + 1} ---\n{page_text}\n"
                    
                    # Detect table-like sections
                    if self._detect_tables(page_text):
                        result["table_sections"].append({
                            "page": page_num + 1,
                            "text": page_text[:500]  # First 500 chars
                        })
                    
                    # Detect signature sections
                    if self._detect_signatures(page_text):
                        result["signature_sections"].append({
                            "page": page_num + 1,
                            "text": page_text
                        })
                        
        except Exception as e:
            print(f"Error extracting text from PDF: {e}")
            
        return result
    
    def _detect_tables(self, text: str) -> bool:
        """Detect if text contains table-like structures"""
        # Check for table patterns
        table_patterns = [
            r'\|\s*[\w\s]+\s*\|',  # Pipe separators
            r'\s{4,}[\w\s]+\s{4,}',  # Multiple spaces as column separators
            r'[-]+\s+[-]+',  # Horizontal lines
            r'\s*\w+\s*\t\s*\w+',  # Tab separators
        ]
        
        for pattern in table_patterns:
            if re.search(pattern, text):
                return True
        
        # Check for tabular keywords
        table_keywords = ['table', 'schedule', 'exhibit', 'attachment', 'appendix']
        text_lower = text.lower()
        
        # Check for column headers
        if any(keyword in text_lower for keyword in table_keywords):
            lines = text.split('\n')
            # Look for lines with consistent spacing
            for line in lines:
                if re.match(r'^\s*[\w\s]+\s{3,}[\w\s]+\s{3,}', line):
                    return True
        
        return False
    
    def _detect_signatures(self, text: str) -> bool:
        """Detect signature-related text"""
        signature_keywords = [
            'signature', 'signed', 'executed', 'witness', 'notary',
            'in witness whereof', 'authorized signatory', 'duly authorized'
        ]
        text_lower = text.lower()
        return any(keyword in text_lower for keyword in signature_keywords)
    

    def _process_with_openai_enhanced(self, context: str, metadata: Dict = None) -> Dict[str, Any]:
        """Process with OpenAI - simplified version"""
        try:
            # Use the existing simple method
            return self._process_with_openai_simple(context)
        except Exception as e:
            print(f"OpenAI enhanced processing failed: {e}")
            # Return basic structure
            return {
                "contract_type": "Agreement",
                "parties": [],
                "dates": {},
                "financial": {},
                "confidence_score": 0.5,
                "extraction_notes": ["Basic extraction due to processing error"]
            }


    def _prepare_llm_context_enhanced(self, plain_text: str, structured_tables: Dict, tables_data: Dict, total_from_tables: float) -> str:
        """Prepare enhanced context for LLM with table data"""
        # Truncate text if too long
        max_text_length = 6000
        if len(plain_text) > max_text_length:
            plain_text = plain_text[:max_text_length] + "... [truncated]"
        
        # Create detailed table summary
        table_summary = "=== IMPORTANT: EXTRACTED TABLE DATA ===\n\n"
        
        if structured_tables.get("payment_schedule"):
            payments = structured_tables["payment_schedule"]
            table_summary += f"PAYMENT SCHEDULE ({len(payments)} payments):\n"
            for i, payment in enumerate(payments[:5]):
                table_summary += f"  {i+1}. {payment.get('description', 'N/A')}: {payment.get('amount', 'N/A')} due {payment.get('due_date', 'N/A')}\n"
        
        if structured_tables.get("deliverables"):
            deliverables = structured_tables["deliverables"]
            table_summary += f"\nDELIVERABLES ({len(deliverables)} items):\n"
            for i, deliverable in enumerate(deliverables[:5]):
                table_summary += f"  {i+1}. {deliverable.get('item', 'N/A')}: Due {deliverable.get('due_date', 'N/A')}\n"
        
        if total_from_tables > 0:
            table_summary += f"\nTOTAL CALCULATED FROM TABLES: {total_from_tables}\n"
        
        context = f"""
        EXTRACTED TABLE DATA:
        {table_summary}
        
        CONTRACT TEXT:
        {plain_text}
        
        INSTRUCTIONS:
        1. Extract all key information from the contract text above
        2. Use the provided table data to populate structured fields
        3. Focus on financial data, dates, parties, and deliverables
        4. Return only valid JSON
        """
        
        return context



    def _get_fallback_with_tables(self, file_content: bytes) -> Dict[str, Any]:
        """Enhanced fallback extraction with table data"""
        # Try to extract tables
        try:
            tables_data = self.table_extractor.extract_tables_from_pdf(file_content)
            structured_tables = self.table_extractor.extract_structured_table_data(tables_data)
        except:
            tables_data = {"total_tables": 0, "tables": []}
            structured_tables = {}
        
        # Calculate total from tables
        total_from_tables = self._calculate_total_from_tables(structured_tables)
        
        return {
            "contract_type": "Unknown",
            "contract_subtype": None,
            "master_agreement_id": None,
            "parties": [],
            "dates": {},
            "financial": {
                "total_value": total_from_tables if total_from_tables > 0 else None,
                "currency": "USD"
            },
            "payment_schedule": structured_tables.get("payment_schedule", []),
            "deliverables": structured_tables.get("deliverables", []),
            "budget": structured_tables.get("budget", []),
            "reporting_requirements": structured_tables.get("reporting_requirements", []),
            "signatories": [],
            "clauses": {},
            "key_fields": {},
            "extracted_tables": {
                "total_tables": tables_data.get("total_tables", 0),
                "tables_by_type": tables_data.get("tables_by_type", {}),
                "extraction_method": "fallback"
            },
            "confidence_score": 0.3,
            "risk_score": 0.5,
            "metadata": {
                "extraction_method": "fallback",
                "has_tables": tables_data.get("total_tables", 0) > 0
            }
        }

    def _process_camelot_tables(self, tables) -> List[Dict[str, Any]]:
        """Process Camelot tables into structured format with NaN cleaning"""
        processed_tables = []
        
        for i, table in enumerate(tables):
            try:
                df = table.df
                
                # Clean the DataFrame - replace NaN with None
                df = df.replace({float('nan'): None, 'nan': None, 'NaN': None, 'NAN': None})
                df = df.dropna(how='all').dropna(axis=1, how='all')
                df = df.reset_index(drop=True)
                
                if df.empty:
                    continue
                
                # Convert to dict and clean NaN values
                data_records = []
                for record in df.to_dict(orient='records'):
                    cleaned_record = {}
                    for key, value in record.items():
                        if isinstance(value, float):
                            import math
                            if math.isnan(value):
                                cleaned_record[key] = None
                            else:
                                cleaned_record[key] = value
                        else:
                            cleaned_record[key] = value
                    data_records.append(cleaned_record)
                
                table_data = {
                    "id": f"table_{i+1}",
                    "page": int(table.page) if hasattr(table, 'page') else 1,
                    "accuracy": float(table.accuracy) if hasattr(table, 'accuracy') else 0.0,
                    "type": "camelot",
                    "rows": len(df),
                    "columns": len(df.columns),
                    "data": data_records,  # Use cleaned records
                    "headers": df.iloc[0].tolist() if len(df) > 0 else [],
                    "raw_data": df.to_dict(orient='split')
                }
                
                processed_tables.append(table_data)
                print(f"  - Table {i+1}: {len(df)} rows, {len(df.columns)} cols")
                
            except Exception as e:
                print(f"Error processing table {i+1}: {e}")
                continue
        
        return processed_tables

    # def process_contract(self, file_content: bytes, metadata: Dict[str, Any] = None) -> Dict[str, Any]:
    #     """Enhanced contract processing with improved table extraction"""
    #     try:
    #         print("Starting enhanced contract processing with improved table extraction...")
            
    #         # Step 1: Extract text from PDF
    #         print("Step 1: Extracting text from PDF...")
    #         text_result = self.extract_text_from_pdf(file_content)
    #         plain_text = text_result["text"]
            
    #         if len(plain_text.strip()) < 100:
    #             print("Warning: Very little text extracted, trying PDFPlumber...")
    #             plain_text = self._extract_text_with_pdfplumber(file_content)
            
    #         # Step 2: Extract tables using enhanced extractor
    #         print("Step 2: Enhanced table extraction...")
    #         tables_data = self.table_extractor.extract_tables_from_pdf(file_content)
            
    #         # Step 3: Structure table data
    #         print("Step 3: Structuring table data...")
    #         structured_tables = self.table_extractor.extract_structured_table_data(tables_data)
            
    #         # Step 4: Calculate total from tables if not in text
    #         total_from_tables = self._calculate_total_from_tables(structured_tables)
    #         print(f"Total calculated from tables: {total_from_tables}")
            
    #         # Step 5: Prepare context for OpenAI with detailed table info
    #         print("Step 5: Preparing enhanced context for OpenAI...")
    #         context = self._prepare_llm_context_enhanced(plain_text, structured_tables, tables_data, total_from_tables)
            
    #         # Step 6: Process with OpenAI
    #         print("Step 6: Processing with OpenAI...")
    #         llm_result = self._process_with_openai_enhanced(context, metadata)
            
    #         # Step 7: Enhance result with table data
    #         print("Step 7: Enhancing result with table data...")
    #         combined_result = self._enhance_extraction_with_tables(llm_result, structured_tables, tables_data, metadata)
            
    #         # Step 8: Calculate metrics
    #         print("Step 8: Calculating metrics...")
    #         combined_result = self._add_metrics_with_tables(combined_result, structured_tables, tables_data)
            
    #         # Check if amendment
    #         is_amendment = metadata and metadata.get('is_amendment', False)
    #         if is_amendment:
    #             combined_result = self._add_amendment_info(combined_result, metadata)
            
    #         print(f"Contract processing completed! Confidence: {combined_result.get('confidence_score', 0.0)}")
    #         return combined_result
            
    #     except Exception as e:
    #         print(f"Error in contract processing: {e}")
    #         import traceback
    #         traceback.print_exc()
    #         return self._get_fallback_with_tables(file_content)

    def _extract_text_with_pdfplumber(self, file_content: bytes) -> str:
        """Extract text using PDFPlumber"""
        import io
        import pdfplumber
        
        text = ""
        with pdfplumber.open(io.BytesIO(file_content)) as pdf:
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n"
        
        return text

    def _calculate_total_from_tables(self, structured_tables: Dict) -> float:
        """Calculate total contract value from tables"""
        total = 0.0
        
        # Sum payment schedule amounts
        for payment in structured_tables.get("payment_schedule", []):
            amount_str = str(payment.get("amount", "0"))
            try:
                # Clean the amount string
                amount_clean = ''.join(c for c in amount_str if c.isdigit() or c == '.' or c == ',')
                if amount_clean:
                    amount = float(amount_clean.replace(',', ''))
                    total += amount
            except:
                pass
        
        # Sum budget items
        for budget_item in structured_tables.get("budget", []):
            amount_str = str(budget_item.get("amount", "0"))
            try:
                amount_clean = ''.join(c for c in amount_str if c.isdigit() or c == '.' or c == ',')
                if amount_clean:
                    amount = float(amount_clean.replace(',', ''))
                    total += amount
            except:
                pass
        
        return total

    def _add_metrics_with_tables(self, extraction: Dict, structured_tables: Dict, tables_data: Dict) -> Dict[str, Any]:
        """Add extraction metrics with table consideration"""
        # Use existing method
        extraction = self._add_metrics(extraction, structured_tables)
        
        # Boost confidence if tables were found
        if tables_data.get("total_tables", 0) > 0:
            current_confidence = extraction.get("confidence_score", 0.5)
            extraction["confidence_score"] = min(current_confidence * 1.2, 0.95)
            extraction["extraction_notes"] = extraction.get("extraction_notes", []) + [
                f"Tables extracted: {tables_data.get('total_tables', 0)}"
            ]
        
        return extraction

    def _add_amendment_info(self, extraction: Dict, metadata: Dict) -> Dict:
        """Add amendment information to extraction"""
        if metadata.get('is_amendment'):
            extraction["amendment_info"] = {
                "is_amendment": True,
                "amendment_type": metadata.get("amendment_type", "modification"),
                "parent_document_id": metadata.get("parent_document_id"),
                "processed_at": datetime.now().isoformat()
            }
        
        return extraction

    def _clean_extraction_for_db(self, extraction: Dict[str, Any]) -> Dict[str, Any]:
        """Clean extraction data for database storage (remove NaN values)"""
        import math
        import copy
        
        def clean_value(value):
            if isinstance(value, float):
                if math.isnan(value):
                    return None
                elif math.isinf(value):
                    return None
                return value
            elif isinstance(value, dict):
                cleaned = {}
                for k, v in value.items():
                    cleaned[k] = clean_value(v)
                return cleaned
            elif isinstance(value, list):
                return [clean_value(item) for item in value]
            elif value is None:
                return None
            else:
                return value
        
        # Create a deep copy to avoid modifying original
        cleaned_extraction = copy.deepcopy(extraction)
        return clean_value(cleaned_extraction)



    def _enhance_extraction_with_tables(self, llm_result: Dict, structured_tables: Dict, tables_data: Dict, metadata: Dict = None) -> Dict:
        """Enhance extraction with table data"""
        enhanced = llm_result.copy() if llm_result else {}
        
        # Ensure financial section exists
        if "financial" not in enhanced:
            enhanced["financial"] = {}
        
        # Add table data
        enhanced["extracted_tables"] = {
            "total_tables": tables_data.get("total_tables", 0),
            "tables_by_type": tables_data.get("tables_by_type", {}),
            "structured_data": structured_tables,
            "extraction_methods": tables_data.get("extraction_methods", []),
            "extraction_success": tables_data.get("extraction_success", False)
        }
        
        # Update total value if not already set or if tables provide better data
        total_from_tables = self._calculate_total_from_tables(structured_tables)
        if total_from_tables > 0:
            current_total = enhanced.get("financial", {}).get("total_value", 0)
            if not current_total or total_from_tables > current_total:
                enhanced["financial"]["total_value"] = total_from_tables
                enhanced["financial"]["_source"] = "calculated_from_tables"
        
        # Add payment schedule if not already present
        if structured_tables.get("payment_schedule") and "payment_schedule" not in enhanced:
            enhanced["payment_schedule"] = structured_tables["payment_schedule"]
        
        # Add deliverables if not already present
        if structured_tables.get("deliverables") and "deliverables" not in enhanced:
            enhanced["deliverables"] = structured_tables["deliverables"]
        
        # Add amendment info
        if metadata and metadata.get("is_amendment"):
            enhanced["amendment_info"] = {
                "is_amendment": True,
                "amendment_type": metadata.get("amendment_type", "modification"),
                "parent_document_id": metadata.get("parent_document_id"),
                "table_updates": len(structured_tables.get("payment_schedule", [])) > 0 or len(structured_tables.get("deliverables", [])) > 0
            }
        
        return enhanced

    # def process_contract(self, file_content: bytes, metadata: Dict[str, Any] = None) -> Dict[str, Any]:
    #     """Enhanced contract processing with table extraction"""
    #     try:
    #         print("Starting enhanced contract processing...")
            
    #         # Step 1: Extract text from PDF
    #         print("Step 1: Extracting text from PDF...")
    #         text_result = self.extract_text_from_pdf(file_content)
    #         plain_text = text_result["text"]
            
    #         if len(plain_text.strip()) < 100:
    #             print("Warning: Very little text extracted, trying alternative extraction...")
    #             # Fallback extraction method
    #             plain_text = self._fallback_text_extraction(file_content)
            
    #         # Step 2: Extract tables using Camelot
    #         print("Step 2: Extracting tables with Camelot...")
    #         tables_data = self.table_extractor.extract_tables_from_pdf(file_content)
            
    #         # Step 3: Structure table data
    #         print("Step 3: Structuring table data...")
    #         structured_tables = self.table_extractor.extract_structured_table_data(tables_data)
            
    #         # Step 4: Prepare context for OpenAI
    #         print("Step 4: Preparing context for OpenAI...")
    #         context = self._prepare_llm_context(plain_text, structured_tables, tables_data)
            
    #         # Step 5: Process with OpenAI
    #         print("Step 5: Processing with OpenAI...")
    #         llm_result = self._process_with_openai_simple(context)
            
    #         # Step 6: Combine results
    #         print("Step 6: Combining results...")
    #         combined_result = self._combine_extractions(llm_result, structured_tables, tables_data)
            
    #         # Step 7: Calculate metrics
    #         print("Step 7: Calculating metrics...")
    #         combined_result = self._add_metrics(combined_result, structured_tables)
            
    #         # FIXED: Check if this is an amendment - moved before metadata check
    #         is_amendment = metadata and metadata.get('is_amendment', False)
    #         parent_doc_id = metadata.get('parent_document_id') if metadata else None
            
    #         # NEW: If this is an amendment, auto-apply if needed
    #         if is_amendment and parent_doc_id:
    #             print(f"Processing as amendment for parent document: {parent_doc_id}")
    #             combined_result = self._apply_amendment_updates(combined_result, parent_doc_id, metadata)
            
    #         # Add metadata
    #         if metadata:
    #             combined_result["metadata"] = {
    #                 **combined_result.get("metadata", {}),
    #                 **metadata,
    #                 "processing_steps": ["text_extraction", "table_extraction", "llm_processing"],
    #                 "table_count": tables_data.get("total_tables", 0),
    #                 "page_count": text_result.get("page_count", 0),
    #                 "extraction_complete": True
    #             }
            
    #         print("Contract processing completed successfully!")
    #         return combined_result
            
    #     except Exception as e:
    #         print(f"Error in enhanced contract processing: {e}")
    #         import traceback
    #         traceback.print_exc()
    #         return self._get_enhanced_fallback_extraction(file_content)

    def _apply_amendment_updates(self, extraction: Dict[str, Any], parent_doc_id: int, metadata: Dict[str, Any]) -> Dict[str, Any]:
        """Apply amendment updates to extraction results"""
        try:
            print(f"Applying amendment updates for parent document: {parent_doc_id}")
            
            # Get amendment type
            amendment_type = metadata.get('amendment_type', 'modification')
            
            # Create a basic updated extraction with amendment info
            updated_extraction = extraction.copy()
            
            # Add amendment tracking info
            updated_extraction['amendment_info'] = {
                'parent_document_id': parent_doc_id,
                'amendment_type': amendment_type,
                'auto_applied': True,
                'timestamp': datetime.now().isoformat()
            }
            
            # Calculate updated values based on amendment type
            if amendment_type == 'addendum' and updated_extraction.get('financial', {}).get('total_value'):
                # For addendums, note that value should be added
                updated_extraction['financial']['_amendment_note'] = f"Value to be added to parent contract"
                print(f"Addendum detected: {updated_extraction['financial'].get('total_value')} to be added")
            
            elif amendment_type == 'modification' and updated_extraction.get('financial', {}).get('total_value'):
                # For modifications, note that value should replace
                updated_extraction['financial']['_amendment_note'] = f"Value to replace parent contract value"
                print(f"Modification detected: {updated_extraction['financial'].get('total_value')} to replace existing")
            
            # Add amendment summary
            updated_extraction['extraction_notes'] = updated_extraction.get('extraction_notes', []) + [
                f"Amendment processed ({amendment_type})",
                f"Parent document ID: {parent_doc_id}"
            ]
            
            return updated_extraction
            
        except Exception as e:
            print(f"Error in amendment updates: {e}")
            # Return original extraction if amendment update fails
            return extraction


    # def process_contract(self, file_content: bytes, metadata: Dict[str, Any] = None) -> Dict[str, Any]:
    #     """Enhanced contract processing with table extraction"""
    #     try:
    #         print("Starting enhanced contract processing...")
            
    #         # Step 1: Extract text from PDF
    #         print("Step 1: Extracting text from PDF...")
    #         text_result = self.extract_text_from_pdf(file_content)
    #         plain_text = text_result["text"]
            
    #         if len(plain_text.strip()) < 100:
    #             print("Warning: Very little text extracted, trying alternative extraction...")
    #             # Fallback extraction method
    #             plain_text = self._fallback_text_extraction(file_content)
            
    #         # Step 2: Extract tables using Camelot
    #         print("Step 2: Extracting tables with Camelot...")
    #         tables_data = self.table_extractor.extract_tables_from_pdf(file_content)
            
    #         # Step 3: Structure table data
    #         print("Step 3: Structuring table data...")
    #         structured_tables = self.table_extractor.extract_structured_table_data(tables_data)
            
    #         # Step 4: Prepare context for OpenAI
    #         print("Step 4: Preparing context for OpenAI...")
    #         context = self._prepare_llm_context(plain_text, structured_tables, tables_data)
            
    #         # Step 5: Process with OpenAI
    #         print("Step 5: Processing with OpenAI...")
    #         llm_result = self._process_with_openai_simple(context)
            
    #         # Step 6: Combine results
    #         print("Step 6: Combining results...")
    #         combined_result = self._combine_extractions(llm_result, structured_tables, tables_data)
            
    #         # Step 7: Calculate metrics
    #         print("Step 7: Calculating metrics...")
    #         combined_result = self._add_metrics(combined_result, structured_tables)

    #         if metadata and metadata.get('is_amendment'):
    #             print("Processing as amendment - checking for auto-application...")
    #             parent_doc_id = metadata.get('parent_document_id')
            
    #         if parent_doc_id:
    #             # Get parent contract details
    #             from app.database import SessionLocal
    #             from app import models
                
    #             db = SessionLocal()
    #             try:
    #                 # Find parent document and contract
    #                 parent_doc = db.query(models.Document).filter(
    #                     models.Document.id == parent_doc_id
    #                 ).first()
                    
    #                 if parent_doc:
    #                     parent_contract = db.query(models.Contract).filter(
    #                         models.Contract.document_id == parent_doc.id
    #                     ).order_by(models.Contract.version.desc()).first()
                        
    #                     if parent_contract:
    #                         # Create a mock amendment contract for comparison
    #                         amendment_contract = models.Contract()
    #                         # Populate with extracted data
    #                         amendment_contract.total_value = combined_result.get('financial', {}).get('total_value')
    #                         amendment_contract.currency = combined_result.get('financial', {}).get('currency')
    #                         amendment_contract.parties = combined_result.get('parties', [])
    #                         amendment_contract.clauses = combined_result.get('clauses', {})
    #                         amendment_contract.key_fields = combined_result.get('key_fields', {})
                            
    #                         # Apply amendment logic
    #                         amendment_type = metadata.get('amendment_type', 'modification')
    #                         combined_result = self._apply_amendment_to_extraction(
    #                             parent_contract, 
    #                             combined_result, 
    #                             amendment_type
    #                         )
                            
    #                         # Add amendment tracking info
    #                         combined_result['amendment_info'] = {
    #                             'parent_contract_id': parent_contract.id,
    #                             'amendment_type': amendment_type,
    #                             'auto_applied': True,
    #                             'parent_version': parent_contract.version
    #                         }
    #             finally:
    #                 db.close()

    #         # Add metadata
    #         if metadata:
    #             combined_result["metadata"] = {
    #                 **combined_result.get("metadata", {}),
    #                 **metadata,
    #                 "processing_steps": ["text_extraction", "table_extraction", "llm_processing"],
    #                 "table_count": tables_data.get("total_tables", 0),
    #                 "page_count": text_result.get("page_count", 0),
    #                 "extraction_complete": True
    #             }
            
    #         print("Contract processing completed successfully!")
    #         return combined_result
            
    #     except Exception as e:
    #         print(f"Error in enhanced contract processing: {e}")
    #         import traceback
    #         traceback.print_exc()
    #         return self._get_enhanced_fallback_extraction(file_content)
    

    # def _apply_amendment_to_extraction(self, parent_contract: Any, amendment_extraction: Dict, amendment_type: str) -> Dict:
    #     """
    #     Apply amendment changes to extraction results
    #     """
    #     updated_extraction = amendment_extraction.copy()
        
    #     # Track what was updated
    #     changes = []
        
    #     # Update financial values based on amendment type
    #     if amendment_extraction.get('financial', {}).get('total_value') is not None:
    #         amendment_value = amendment_extraction['financial']['total_value']
    #         parent_value = getattr(parent_contract, 'total_value', None)
            
    #         if amendment_type in ['modification', 'correction']:
    #             # Direct replacement
    #             updated_extraction['financial']['total_value'] = amendment_value
    #             if parent_value is not None:
    #                 changes.append(f"Total value updated from {parent_value} to {amendment_value}")
            
    #         elif amendment_type == 'addendum':
    #             # Addition to existing value
    #             new_value = (parent_value or 0) + (amendment_value or 0)
    #             updated_extraction['financial']['total_value'] = new_value
    #             changes.append(f"Total value increased by {amendment_value} to {new_value}")
            
    #         elif amendment_type in ['extension', 'renewal']:
    #             # For extensions/renewals, keep the value unless specified otherwise
    #             if amendment_value != parent_value:
    #                 updated_extraction['financial']['total_value'] = amendment_value
    #                 changes.append(f"Total value updated to {amendment_value}")
        
    #     # Update dates for extensions/renewals
    #     if amendment_type in ['extension', 'renewal']:
    #         if amendment_extraction.get('dates', {}).get('expiration_date'):
    #             updated_extraction['dates']['expiration_date'] = amendment_extraction['dates']['expiration_date']
    #             changes.append(f"Expiration date extended to {amendment_extraction['dates']['expiration_date']}")
        
    #     # Update parties for addendums
    #     if amendment_type == 'addendum' and amendment_extraction.get('parties'):
    #         parent_parties = getattr(parent_contract, 'parties', []) or []
    #         amendment_parties = amendment_extraction.get('parties', [])
            
    #         # Combine parties (unique)
    #         combined_parties = list(set(parent_parties + amendment_parties))
    #         if len(combined_parties) > len(parent_parties):
    #             updated_extraction['parties'] = combined_parties
    #             changes.append(f"Added new parties: {list(set(amendment_parties) - set(parent_parties))}")
        
    #     # Update clauses
    #     if amendment_extraction.get('clauses'):
    #         parent_clauses = getattr(parent_contract, 'clauses', {}) or {}
    #         amendment_clauses = amendment_extraction.get('clauses', {})
            
    #         if amendment_type == 'addendum':
    #             # Add new clauses
    #             updated_clauses = {**parent_clauses, **amendment_clauses}
    #             updated_extraction['clauses'] = updated_clauses
    #             new_clauses = set(amendment_clauses.keys()) - set(parent_clauses.keys())
    #             if new_clauses:
    #                 changes.append(f"Added new clauses: {list(new_clauses)}")
    #         else:
    #             # Update existing clauses
    #             updated_clauses = parent_clauses.copy()
    #             for clause_name, clause_value in amendment_clauses.items():
    #                 if clause_name in parent_clauses and parent_clauses[clause_name] != clause_value:
    #                     changes.append(f"Updated clause '{clause_name}'")
    #                 updated_clauses[clause_name] = clause_value
    #             updated_extraction['clauses'] = updated_clauses
        
    #     # Add change tracking
    #     if changes:
    #         updated_extraction['change_summary'] = f"Amendment ({amendment_type}): " + "; ".join(changes)
    #         updated_extraction['amendment_changes'] = changes
        
    #     return updated_extraction    

    def _prepare_llm_context(self, plain_text: str, structured_tables: Dict, tables_data: Dict) -> str:
        """Prepare context for LLM processing with detailed table info"""
        # Truncate text if too long
        max_text_length = 8000
        if len(plain_text) > max_text_length:
            plain_text = plain_text[:max_text_length] + "... [truncated]"
        
        # Create detailed table summary
        table_summary = "=== IMPORTANT: EXTRACTED TABLE DATA ===\n\n"
        
        # Payment schedules
        if structured_tables.get("payment_schedule"):
            payments = structured_tables["payment_schedule"]
            table_summary += f"PAYMENT SCHEDULE ({len(payments)} payments):\n"
            for i, payment in enumerate(payments[:10]):  # Show first 10
                table_summary += f"{i+1}. {payment.get('description', 'N/A')}: {payment.get('amount', 'N/A')} due {payment.get('due_date', 'N/A')}\n"
            if len(payments) > 10:
                table_summary += f"... and {len(payments) - 10} more payments\n"
            table_summary += "\n"
        
        # Deliverables
        if structured_tables.get("deliverables"):
            deliverables = structured_tables["deliverables"]
            table_summary += f"DELIVERABLES ({len(deliverables)} items):\n"
            for i, deliverable in enumerate(deliverables[:10]):
                table_summary += f"{i+1}. {deliverable.get('item', 'N/A')}: Due {deliverable.get('due_date', 'N/A')} - Status: {deliverable.get('status', 'N/A')}\n"
            if len(deliverables) > 10:
                table_summary += f"... and {len(deliverables) - 10} more deliverables\n"
            table_summary += "\n"
        
        # Budget
        if structured_tables.get("budget"):
            budget_items = structured_tables["budget"]
            table_summary += f"BUDGET ITEMS ({len(budget_items)} items):\n"
            total_budget = 0
            for i, item in enumerate(budget_items[:10]):
                amount_str = str(item.get('amount', '0'))
                # Try to extract numeric value
                try:
                    # Remove non-numeric characters except decimal point
                    amount_clean = ''.join(c for c in amount_str if c.isdigit() or c == '.' or c == ',')
                    if amount_clean:
                        amount = float(amount_clean.replace(',', ''))
                        total_budget += amount
                except:
                    pass
                table_summary += f"{i+1}. {item.get('category', 'N/A')}: {amount_str}\n"
            table_summary += f"TOTAL BUDGET (estimated): {total_budget}\n\n"
        
        # Add raw table info
        table_summary += f"TABLE EXTRACTION SUMMARY:\n"
        table_summary += f"- Total tables found: {tables_data.get('total_tables', 0)}\n"
        table_summary += f"- Extraction methods: {', '.join(tables_data.get('extraction_methods', []))}\n"
        
        # Add specific table types found
        table_types = tables_data.get('tables_by_type', {})
        if table_types:
            table_summary += "- Table types found:\n"
            for ttype, count in table_types.items():
                table_summary += f"  * {ttype}: {count} table(s)\n"
        
        system_prompt = """You are an expert contract analyst. Extract ALL contract information including financial data, dates, parties, and especially TABLE DATA.

    CRITICAL INSTRUCTIONS:
    1. PAY SPECIAL ATTENTION TO TABLE DATA provided below - it contains key contractual terms
    2. Extract ALL payment amounts, dates, and terms from tables
    3. Calculate TOTAL CONTRACT VALUE from payment schedules if not explicitly stated
    4. Extract ALL deliverables and their due dates
    5. For amendments: Note what values are being changed/added

    TABLE DATA PROVIDED:
    {table_data}

    CONTRACT TEXT:
    {contract_text}

    Return COMPLETE JSON with these fields:
    1. contract_type, contract_subtype
    2. parties (list ALL parties with full names)
    3. dates (effective_date, expiration_date, execution_date, termination_date)
    4. financial (total_value, currency, payment_terms) - CALCULATE total from tables if needed
    5. payment_schedule (list of payments from tables)
    6. deliverables (list from tables)
    7. key_fields (important terms found)
    8. extraction_notes (what was extracted, any issues)
    9. confidence_score (0.0-1.0 based on completeness)

    IMPORTANT: If this is an amendment, include amendment_info field with:
    - amendment_type
    - changes_made (list of changes)
    - parent_contract_reference (if known)"""

        context = system_prompt.format(
            table_data=table_summary,
            contract_text=plain_text[:6000]  # Limit text size
        )
        
        return context


    # def _prepare_llm_context(self, plain_text: str, structured_tables: Dict, tables_data: Dict) -> str:
    #     """Prepare context for LLM processing"""
    #     # Truncate text if too long
    #     max_text_length = 10000
    #     if len(plain_text) > max_text_length:
    #         plain_text = plain_text[:max_text_length] + "... [truncated]"
        
    #     # Create table summary
    #     table_summary = "EXTRACTED TABLES DATA:\n\n"
        
    #     if structured_tables.get("payment_schedule"):
    #         table_summary += f"PAYMENT SCHEDULE ({len(structured_tables['payment_schedule'])} items):\n"
    #         for payment in structured_tables["payment_schedule"][:5]:  # Show first 5
    #             table_summary += f"  - {payment.get('description', 'N/A')}: {payment.get('amount', 'N/A')} due {payment.get('due_date', 'N/A')}\n"
        
    #     if structured_tables.get("deliverables"):
    #         table_summary += f"\nDELIVERABLES ({len(structured_tables['deliverables'])} items):\n"
    #         for deliverable in structured_tables["deliverables"][:5]:
    #             table_summary += f"  - {deliverable.get('item', 'N/A')}: Due {deliverable.get('due_date', 'N/A')}\n"
        
    #     if structured_tables.get("reporting_requirements"):
    #         table_summary += f"\nREPORTING REQUIREMENTS ({len(structured_tables['reporting_requirements'])} items):\n"
    #         for report in structured_tables["reporting_requirements"][:5]:
    #             table_summary += f"  - {report.get('type', 'N/A')}: {report.get('frequency', 'N/A')}\n"
        
    #     context = f"""
    #     CONTRACT TEXT:
    #     {plain_text}
        
    #     {table_summary}
        
    #     ADDITIONAL TABLES FOUND: {tables_data.get('total_tables', 0)} total tables
    #     TABLE TYPES: {', '.join(tables_data.get('tables_by_type', {}).keys())}
        
    #     INSTRUCTIONS:
    #     1. Extract all key information from the contract text above
    #     2. Use the provided table data to populate structured fields
    #     3. Focus on accuracy and completeness
    #     4. Return only valid JSON
    #     """
        
    #     return context

    def _process_with_openai_simple(self, context: str) -> Dict[str, Any]:
        """Process context with OpenAI - SIMPLIFIED VERSION (No Proxy)"""
        try:
            # Get API key directly - ensure it's loaded
            api_key = os.getenv("OPENAI_API_KEY")
            
            if not api_key:
                print("CRITICAL: OPENAI_API_KEY not found in os.environ")
                # Try to load from .env directly
                try:
                    from dotenv import load_dotenv
                    load_dotenv()
                    api_key = os.getenv("OPENAI_API_KEY")
                except:
                    pass
                
            if not api_key:
                print("Using enhanced fallback extraction (no API key)")
                return self._create_enhanced_basic_extraction_from_context(context)
            
            # Clean the API key (remove quotes, whitespace)
            api_key = api_key.strip().strip('"').strip("'")
            print(f"API Key loaded: {api_key[:8]}...{api_key[-4:] if len(api_key) > 12 else '***'}")
            
            # Create the simplest possible OpenAI client
            try:
                # Method 1: Direct OpenAI import with minimal config
                import openai
                from openai import OpenAI
                
                # Create client with ONLY api_key
                client = OpenAI(
                    api_key=api_key
                    # NO other parameters - especially no proxies
                )
                
                print("OpenAI client created successfully (Method 1)")
                
            except Exception as e:
                print(f"Method 1 failed: {e}")
                
                # Method 2: Try setting API key directly
                try:
                    import openai
                    openai.api_key = api_key
                    
                    # Use client with explicit organization
                    client = OpenAI(
                        api_key=api_key,
                        organization=None  # Explicitly set to None
                    )
                    print("OpenAI client created successfully (Method 2)")
                    
                except Exception as e2:
                    print(f"Method 2 failed: {e2}")
                    return self._create_enhanced_basic_extraction_from_context(context)
            
            # Send request
            print("Sending request to OpenAI...")
            
            try:
                response = client.chat.completions.create(
                    model="gpt-3.5-turbo",  # Use cheaper model for testing
                    messages=[
                        {"role": "system", "content": self.system_prompt},
                        {"role": "user", "content": context[:15000]}  # Limit context size
                    ],
                    temperature=0.1,
                    max_tokens=2000,
                    response_format={"type": "json_object"}
                )
                
                print("OpenAI response received")
                result = json.loads(response.choices[0].message.content)
                
                # Add confidence boost
                if "confidence_score" in result:
                    result["confidence_score"] = min(result["confidence_score"] * 1.3, 0.95)
                else:
                    result["confidence_score"] = 0.85
                    
                result["extraction_notes"] = result.get("extraction_notes", []) + ["AI-powered extraction"]
                
                return result
                
            except Exception as e:
                print(f"OpenAI API call failed: {e}")
                return self._create_enhanced_basic_extraction_from_context(context)
                
        except Exception as e:
            print(f"Unexpected error in OpenAI processing: {e}")
            return self._create_enhanced_basic_extraction_from_context(context)

    # def _process_with_openai_simple(self, context: str) -> Dict[str, Any]:
    #     """Process context with OpenAI using simple client - FIXED VERSION"""
    #     try:
    #         # Get API key directly from environment
    #         api_key = os.getenv("OPENAI_API_KEY")
    #         if not api_key:
    #             print("Warning: OPENAI_API_KEY not found in environment")
    #             return self._create_enhanced_basic_extraction_from_context(context)
            
    #         print(f"API Key found (first 10 chars): {api_key[:10]}...")
            
    #         # Create client with minimal configuration - FIXED APPROACH
    #         try:
    #             # Import here to avoid any global issues
    #             from openai import OpenAI
                
    #             # Create the simplest possible client
    #             client = OpenAI(
    #                 api_key=api_key,
    #                 # No additional parameters that could cause issues
    #             )
                
    #             print("OpenAI client created successfully")
                
    #         except Exception as client_error:
    #             print(f"Failed to create OpenAI client: {client_error}")
                
    #             # Try alternative approach
    #             try:
    #                 import openai
    #                 openai.api_key = api_key
                    
    #                 # Use older API style as fallback
    #                 import openai_old
    #                 response = openai_old.ChatCompletion.create(
    #                     model="gpt-4o-mini",
    #                     messages=[
    #                         {"role": "system", "content": self.system_prompt},
    #                         {"role": "user", "content": context}
    #                     ],
    #                     temperature=0.1,
    #                     max_tokens=4000
    #                 )
                    
    #                 result = response.choices[0].message.content
    #                 return json.loads(result)
                    
    #             except Exception as old_api_error:
    #                 print(f"Old API approach also failed: {old_api_error}")
    #                 return self._create_enhanced_basic_extraction_from_context(context)
            
    #         # Send request to OpenAI
    #         print("Sending request to OpenAI...")
            
    #         response = client.chat.completions.create(
    #             model="gpt-4o-mini",
    #             messages=[
    #                 {"role": "system", "content": self.system_prompt},
    #                 {"role": "user", "content": context}
    #             ],
    #             temperature=0.1,
    #             max_tokens=4000,
    #             response_format={"type": "json_object"}
    #         )
            
    #         print("OpenAI response received successfully")
    #         result = json.loads(response.choices[0].message.content)
            
    #         # Add confidence boost for successful OpenAI extraction
    #         if result:
    #             result["extraction_notes"] = result.get("extraction_notes", []) + ["OpenAI extraction successful"]
    #             # Boost confidence for OpenAI extraction
    #             if "confidence_score" in result:
    #                 result["confidence_score"] = min(result["confidence_score"] * 1.2, 0.95)
    #             else:
    #                 result["confidence_score"] = 0.9
            
    #         return result
            
    #     except Exception as e:
    #         print(f"Error processing with OpenAI: {e}")
    #         import traceback
    #         traceback.print_exc()
    #         print("Using enhanced fallback extraction...")
    #         return self._create_enhanced_basic_extraction_from_context(context)
   
    # def _process_with_openai_simple(self, context: str) -> Dict[str, Any]:
    #     """Process context with OpenAI using simple client"""
    #     try:
    #         # Get API key directly from environment
    #         api_key = os.getenv("OPENAI_API_KEY")
    #         if not api_key:
    #             print("Warning: OPENAI_API_KEY not found in environment")
    #             return self._create_basic_extraction_from_context(context)
            
    #         # Create client with minimal configuration
    #         try:
    #             client = OpenAI(api_key=api_key)
    #         except Exception as client_error:
    #             print(f"Failed to create OpenAI client: {client_error}")
    #             return self._create_basic_extraction_from_context(context)
            
    #         response = client.chat.completions.create(
    #             model="gpt-4o-mini",
    #             messages=[
    #                 {"role": "system", "content": self.system_prompt},
    #                 {"role": "user", "content": context}
    #             ],
    #             temperature=0.1,
    #             max_tokens=4000,
    #             response_format={"type": "json_object"}
    #         )
            
    #         return json.loads(response.choices[0].message.content)
            
    #     except Exception as e:
    #         print(f"Error processing with OpenAI: {e}")
    #         print("Using fallback extraction...")
    #         return self._create_basic_extraction_from_context(context)
    # def _process_with_openai_simple(self, context: str) -> Dict[str, Any]:
    #     """Process context with OpenAI using simple client"""
    #     try:
    #         # Get API key directly from environment
    #         api_key = os.getenv("OPENAI_API_KEY")
    #         if not api_key:
    #             print("Warning: OPENAI_API_KEY not found in environment")
    #             return self._create_basic_extraction_from_context(context)
            
    #         # Create client with minimal configuration - FIXED VERSION
    #         try:
    #             # Use the simplest possible client initialization
    #             from openai import OpenAI
    #             client = OpenAI(
    #                 api_key=api_key,
    #                 # Remove any proxy settings that might be causing issues
    #             )
    #         except Exception as client_error:
    #             print(f"Failed to create OpenAI client: {client_error}")
    #             print("Trying alternative client creation...")
    #             # Try even simpler approach
    #             client = OpenAI(api_key=api_key)
            
    #         print("OpenAI client created successfully, sending request...")
            
    #         response = client.chat.completions.create(
    #             model="gpt-4o-mini",
    #             messages=[
    #                 {"role": "system", "content": self.system_prompt},
    #                 {"role": "user", "content": context}
    #             ],
    #             temperature=0.1,
    #             max_tokens=4000,
    #             response_format={"type": "json_object"}
    #         )
            
    #         print("OpenAI response received successfully")
    #         return json.loads(response.choices[0].message.content)
            
    #     except Exception as e:
    #         print(f"Error processing with OpenAI: {e}")
    #         print("Using fallback extraction...")
    #         return self._create_basic_extraction_from_context(context)

    def _create_enhanced_basic_extraction_from_context(self, context: str) -> Dict[str, Any]:
        """Create enhanced basic extraction with better confidence"""
        import re
        from datetime import datetime
        
        print("Using enhanced basic extraction...")
        
        # Extract parties with better patterns
        parties = []
        
        # Enhanced party extraction patterns
        party_patterns = [
            r"(?:between|by and between)\s+(.+?)\s+(?:and|&)\s+(.+)",
            r"(?:parties|party)[:\s]+(.+?)\s+(?:and|&)\s+(.+)",
            r"1\.\s*(.+?)[:\s]*(.+)",
            r"(?:this agreement|contract).*?\s+between\s+(.+?)\s+and\s+(.+)",
        ]
        
        for pattern in party_patterns:
            matches = re.finditer(pattern, context, re.IGNORECASE | re.DOTALL)
            for match in matches:
                for i in [1, 2]:  # Get both parties
                    party = match.group(i)
                    if party and len(party.strip()) > 3:
                        # Clean up the party name
                        party = party.strip().strip(',;:')
                        # Remove common prefixes
                        party = re.sub(r'^(?:between|by and between|party|parties|1\.)\s*', '', party, flags=re.IGNORECASE)
                        if party and party not in parties:
                            parties.append(party)
        
        # If no parties found, try alternative approach
        if not parties:
            # Look for company names in ALL CAPS or with Inc/Ltd
            company_patterns = [
                r'([A-Z][A-Z\s&,]+(?:INC|LLC|LTD|CORP|CORPORATION|COMPANY)\b)',
                r'([A-Z][A-Za-z\s&,]+(?:Inc\.?|LLC|Ltd\.?|Corp\.?|Corporation|Company)\b)'
            ]
            
            for pattern in company_patterns:
                matches = re.findall(pattern, context)
                for match in matches:
                    if len(match.strip()) > 3:
                        parties.append(match.strip())
        
        # If still no parties, use default
        if not parties:
            parties = ["Party A", "Party B"]
        
        # Extract contract value with better patterns
        value = None
        value_patterns = [
            r'\$\s*([\d,]+(?:\.\d{2})?)',
            r'USD\s*([\d,]+(?:\.\d{2})?)',
            r'(?:amount|value|total|consideration)[:\s]*\$?\s*([\d,]+(?:\.\d{2})?)',
            r'(?:usd|dollars)\s*([\d,]+(?:\.\d{2})?)',
        ]
        
        for pattern in value_patterns:
            matches = re.findall(pattern, context, re.IGNORECASE)
            for match in matches:
                try:
                    # Take the largest value found
                    clean_value = float(match.replace(',', ''))
                    if value is None or clean_value > value:
                        value = clean_value
                except:
                    pass
        
        # Extract dates with better patterns
        dates = {}
        date_patterns = [
            r'(\d{4}-\d{2}-\d{2})',  # YYYY-MM-DD
            r'(\d{2}/\d{2}/\d{4})',  # MM/DD/YYYY
            r'(\d{2}-\d{2}-\d{4})',  # DD-MM-YYYY
            r'(\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4})',  # 01 January 2024
            r'(?:effective|commencement)[:\s]*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})',
            r'(?:expiration|termination|end)[:\s]*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})',
        ]
        
        all_dates = []
        for pattern in date_patterns:
            matches = re.findall(pattern, context, re.IGNORECASE)
            all_dates.extend(matches)
        
        # Assign dates intelligently
        if all_dates:
            # Try to identify date types
            for i, date_str in enumerate(all_dates[:3]):  # Look at first 3 dates
                if i == 0:
                    dates["execution_date"] = date_str
                elif i == 1:
                    dates["effective_date"] = date_str
                elif i == 2:
                    dates["expiration_date"] = date_str
        
        # Try to detect contract type from content
        contract_type = "Agreement"
        type_patterns = {
            "Service Agreement": ["service agreement", "services agreement", "statement of work", "sow"],
            "NDA": ["non-disclosure", "nda", "confidentiality"],
            "Purchase Agreement": ["purchase agreement", "purchase order", "po"],
            "License Agreement": ["license agreement", "software license", "licensing"],
            "Consulting Agreement": ["consulting agreement", "consultant agreement"],
            "Employment Agreement": ["employment agreement", "employment contract"],
            "Lease Agreement": ["lease agreement", "rental agreement"],
            "Loan Agreement": ["loan agreement", "promissory note"],
            "Partnership Agreement": ["partnership agreement", "joint venture"],
            "Settlement Agreement": ["settlement agreement", "release agreement"],
        }
        
        context_lower = context.lower()
        for type_name, keywords in type_patterns.items():
            if any(keyword in context_lower for keyword in keywords):
                contract_type = type_name
                break
        
        # Check if it's an invoice
        if "invoice" in context_lower or "inv-" in context_lower or "invoice no" in context_lower:
            contract_type = "Invoice"
        
        # Calculate confidence based on extracted data
        confidence_factors = []
        
        # Parties extracted (30%)
        if len(parties) >= 2:
            confidence_factors.append(0.3)
        elif len(parties) >= 1:
            confidence_factors.append(0.15)
        
        # Value extracted (25%)
        if value is not None:
            confidence_factors.append(0.25)
        
        # Dates extracted (25%)
        if dates:
            date_count = len(dates)
            confidence_factors.append(min(date_count * 0.1, 0.25))
        
        # Contract type identified (20%)
        if contract_type != "Agreement":
            confidence_factors.append(0.2)
        
        # Calculate final confidence
        confidence = sum(confidence_factors) if confidence_factors else 0.3
        
        # Boost confidence if we extracted meaningful data
        if len(parties) >= 2 and (value is not None or dates):
            confidence = min(confidence * 1.3, 0.85)
        
        return {
            "contract_type": contract_type,
            "contract_subtype": None,
            "master_agreement_id": None,
            "parties": list(set(parties[:2])),  # Limit to 2 parties max
            "dates": dates,
            "financial": {
                "total_value": value,
                "currency": "USD",
                "payment_terms": "Net 30"
            },
            "tables_summary": {
                "payment_schedules_count": 0,
                "deliverables_count": 0,
                "budget_items_count": 0,
                "reporting_requirements_count": 0
            },
            "contact_information": {
                "signatories": []
            },
            "key_fields": {},
            "risk_indicators": {
                "auto_renewal": False,
                "unlimited_liability": False
            },
            "confidence_score": confidence,
            "extraction_notes": [
                "Enhanced basic extraction using advanced pattern matching",
                f"Extracted {len(parties)} parties",
                f"Contract value: {value if value else 'Not found'}",
                f"Contract type identified as: {contract_type}"
            ]
        }     

    # def _create_basic_extraction_from_context(self, context: str) -> Dict[str, Any]:
    #     """Create basic extraction when OpenAI fails"""
    #     import re
        
    #     # Extract parties from context
    #     parties = []
    #     if "PARTY" in context.upper() or "BETWEEN" in context.upper():
    #         # Look for party patterns
    #         party_patterns = [
    #             r"between\s+([^,]+)\s+and\s+([^,.]+)",
    #             r"PARTIES:\s*(.+)",
    #             r"1\.\s*([^:]+):",
    #         ]
            
    #         for pattern in party_patterns:
    #             matches = re.findall(pattern, context, re.IGNORECASE | re.MULTILINE)
    #             for match in matches:
    #                 if isinstance(match, tuple):
    #                     for party in match:
    #                         if party.strip():
    #                             parties.append(party.strip())
    #                 else:
    #                     if match.strip():
    #                         parties.append(match.strip())
        
    #     # Extract contract value
    #     value = None
    #     value_matches = re.findall(r'\$?\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)', context)
    #     if value_matches:
    #         try:
    #             # Take the largest value found
    #             values = []
    #             for match in value_matches:
    #                 try:
    #                     values.append(float(match.replace(',', '')))
    #                 except:
    #                     pass
    #             if values:
    #                 value = max(values)
    #         except:
    #             pass
        
    #     # Extract dates
    #     dates = {}
    #     date_patterns = [
    #         r'(\d{4}-\d{2}-\d{2})',  # YYYY-MM-DD
    #         r'(\d{2}/\d{2}/\d{4})',  # MM/DD/YYYY
    #     ]
        
    #     for pattern in date_patterns:
    #         matches = re.findall(pattern, context)
    #         if matches:
    #             dates["execution_date"] = matches[0]
    #             if len(matches) > 1:
    #                 dates["effective_date"] = matches[1]
    #             if len(matches) > 2:
    #                 dates["expiration_date"] = matches[2]
    #             break
        
    #     return {
    #         "contract_type": "Unknown",
    #         "contract_subtype": None,
    #         "master_agreement_id": None,
    #         "parties": list(set(parties)) if parties else ["Unknown Party 1", "Unknown Party 2"],
    #         "dates": dates if dates else {},
    #         "financial": {
    #             "total_value": value,
    #             "currency": "USD"
    #         },
    #         "contact_information": {
    #             "signatories": []
    #         },
    #         "key_fields": {},
    #         "risk_indicators": {},
    #         "confidence_score": 0.5,
    #         "extraction_notes": ["Basic extraction due to OpenAI API limitations"]
    #     }
    
    def _combine_extractions(self, llm_result: Dict, structured_tables: Dict, tables_data: Dict) -> Dict[str, Any]:
        """Combine LLM extraction with structured table data"""
        # Start with LLM result
        combined = llm_result.copy() if llm_result else {}
        
        # Add structured table data
        if structured_tables:
            if "payment_schedule" not in combined:
                combined["payment_schedule"] = []
            combined["payment_schedule"].extend(structured_tables.get("payment_schedule", []))
            
            if "deliverables" not in combined:
                combined["deliverables"] = []
            combined["deliverables"].extend(structured_tables.get("deliverables", []))
            
            if "budget" not in combined:
                combined["budget"] = []
            combined["budget"].extend(structured_tables.get("budget", []))
            
            if "reporting_requirements" not in combined:
                combined["reporting_requirements"] = []
            combined["reporting_requirements"].extend(structured_tables.get("reporting_requirements", []))
            
            if "personnel" not in combined:
                combined["personnel"] = []
            combined["personnel"].extend(structured_tables.get("personnel", []))
            
            if "signatories" not in combined:
                combined["signatories"] = []
            combined["signatories"].extend(structured_tables.get("signatories", []))
            
            if "compliance" not in combined:
                combined["compliance"] = []
            combined["compliance"].extend(structured_tables.get("compliance", []))
        
        # Add table metadata
        combined["extracted_tables"] = {
            "total_tables": tables_data.get("total_tables", 0),
            "tables_by_type": tables_data.get("tables_by_type", {}),
            "extraction_method": "camelot"
        }
        
        return combined
    
    def _add_metrics(self, extraction: Dict, structured_tables: Dict) -> Dict[str, Any]:
        """Add extraction metrics with improved confidence calculation"""
        # Start with extraction confidence if it exists
        base_confidence = extraction.get("confidence_score", 0.5)
        
        # Calculate additional confidence factors
        confidence_factors = []
        
        # Essential fields (40% max)
        essential_fields = ["contract_type", "parties", "dates", "financial"]
        essential_present = sum(1 for field in essential_fields if extraction.get(field))
        essential_score = (essential_present / len(essential_fields)) * 0.4
        confidence_factors.append(essential_score)
        
        # Check for specific data in each field (30% max)
        field_scores = []
        
        # Contract type
        if extraction.get("contract_type") and extraction["contract_type"] != "Unknown":
            field_scores.append(0.05)
        
        # Parties
        if extraction.get("parties") and len(extraction["parties"]) >= 1:
            field_scores.append(0.1)
        
        # Dates
        if extraction.get("dates"):
            date_count = len([v for v in extraction["dates"].values() if v])
            field_scores.append(min(date_count * 0.05, 0.15))
        
        # Financial
        if extraction.get("financial", {}).get("total_value"):
            field_scores.append(0.1)
        
        confidence_factors.append(sum(field_scores))
        
        # Table data (20% max)
        if structured_tables:
            table_types = len(structured_tables.keys())
            table_items = sum(len(v) for v in structured_tables.values() if isinstance(v, list))
            
            if table_types > 0:
                confidence_factors.append(min(table_types * 0.05, 0.1))
            if table_items > 0:
                confidence_factors.append(min(table_items * 0.01, 0.1))
        
        # Calculate final confidence
        calculated_confidence = sum(confidence_factors)
        
        # Use the higher of base or calculated confidence
        final_confidence = max(base_confidence, calculated_confidence)
        
        # Ensure minimum confidence for any extraction
        if final_confidence < 0.3 and (extraction.get("parties") or extraction.get("contract_type") != "Unknown"):
            final_confidence = 0.4
        
        # Boost confidence if we have good data
        if extraction.get("contract_type") != "Unknown" and extraction.get("parties"):
            final_confidence = min(final_confidence * 1.2, 0.85)
        
        extraction["confidence_score"] = min(final_confidence, 0.99)
        
        # Calculate risk score
        extraction["risk_score"] = self._calculate_enhanced_risk_score(extraction)
        
        # Add extraction quality assessment
        if extraction["confidence_score"] >= 0.8:
            extraction["extraction_quality"] = "High"
        elif extraction["confidence_score"] >= 0.6:
            extraction["extraction_quality"] = "Medium"
        else:
            extraction["extraction_quality"] = "Basic"
        
        return extraction

    # def _add_metrics(self, extraction: Dict, structured_tables: Dict) -> Dict[str, Any]:
    #     """Add extraction metrics"""
    #     # Calculate confidence based on extracted data
    #     confidence_factors = []
        
    #     # Check for essential fields
    #     essential_fields = ["contract_type", "parties", "dates"]
    #     essential_count = sum(1 for field in essential_fields if extraction.get(field))
    #     confidence_factors.append(essential_count / len(essential_fields) * 0.4)
        
    #     # Check for financial data
    #     if extraction.get("financial", {}).get("total_value"):
    #         confidence_factors.append(0.2)
        
    #     # Check for extracted tables
    #     table_data_present = any([
    #         structured_tables.get("payment_schedule"),
    #         structured_tables.get("deliverables"),
    #         structured_tables.get("budget")
    #     ])
    #     if table_data_present:
    #         confidence_factors.append(0.2)
        
    #     # Check for contact information
    #     if extraction.get("contact_information", {}).get("signatories"):
    #         confidence_factors.append(0.1)
        
    #     if extraction.get("key_fields"):
    #         confidence_factors.append(0.1)
        
    #     # Calculate final confidence
    #     confidence = sum(confidence_factors) if confidence_factors else 0.5
    #     extraction["confidence_score"] = min(confidence, 0.99)
        
    #     # Calculate risk score
    #     extraction["risk_score"] = self._calculate_enhanced_risk_score(extraction)
        
    #     return extraction
    
    def _calculate_enhanced_risk_score(self, extraction: Dict) -> float:
        """Enhanced risk score calculation"""
        risk_score = 0.0
        
        # Financial risk
        financial = extraction.get("financial", {})
        total_value = financial.get("total_value", 0)
        if isinstance(total_value, str):
            try:
                total_value = float(''.join(filter(str.isdigit, str(total_value))))
            except:
                total_value = 0
        
        if total_value > 1000000:
            risk_score += 0.2
        elif total_value > 500000:
            risk_score += 0.1
        
        # Date risk
        dates = extraction.get("dates", {})
        if dates.get("expiration_date"):
            try:
                exp_date = datetime.fromisoformat(dates["expiration_date"].replace('Z', '+00:00'))
                days_remaining = (exp_date - datetime.now()).days
                if days_remaining < 30:
                    risk_score += 0.3
                elif days_remaining < 90:
                    risk_score += 0.2
                elif days_remaining < 180:
                    risk_score += 0.1
            except:
                pass
        
        # Contract type risk
        contract_type = str(extraction.get("contract_type", "")).lower()
        high_risk_types = ["indemnity", "guarantee", "surety", "bond", "insurance"]
        if any(risk_type in contract_type for risk_type in high_risk_types):
            risk_score += 0.2
        
        # Auto-renewal risk
        if extraction.get("risk_indicators", {}).get("auto_renewal"):
            risk_score += 0.1
        
        # Normalize
        return min(risk_score, 1.0)
    
    def _fallback_text_extraction(self, file_content: bytes) -> str:
        """Fallback text extraction method"""
        try:
            import pdfplumber
            
            with pdfplumber.open(BytesIO(file_content)) as pdf:
                text = ""
                for page in pdf.pages:
                    page_text = page.extract_text()
                    if page_text:
                        text += page_text + "\n"
                return text
        except Exception as e:
            print(f"Fallback extraction failed: {e}")
            return "Text extraction failed"
    
    def _get_enhanced_fallback_extraction(self, file_content: bytes) -> Dict[str, Any]:
        """Enhanced fallback extraction with table data"""
        # Try to at least extract tables
        try:
            tables_data = self.table_extractor.extract_tables_from_pdf(file_content)
            structured_tables = self.table_extractor.extract_structured_table_data(tables_data)
        except:
            tables_data = {"total_tables": 0, "tables": []}
            structured_tables = {}
        
        return {
            "contract_type": "Unknown",
            "contract_subtype": None,
            "master_agreement_id": None,
            "parties": [],
            "dates": {},
            "financial": {},
            "payment_schedule": structured_tables.get("payment_schedule", []),
            "deliverables": structured_tables.get("deliverables", []),
            "budget": structured_tables.get("budget", []),
            "reporting_requirements": structured_tables.get("reporting_requirements", []),
            "signatories": structured_tables.get("signatories", []),
            "clauses": {},
            "key_fields": {},
            "extracted_tables": {
                "total_tables": tables_data.get("total_tables", 0),
                "tables_by_type": tables_data.get("tables_by_type", {}),
                "extraction_method": "camelot_fallback"
            },
            "confidence_score": 0.3,
            "risk_score": 0.5,
            "metadata": {
                "extraction_method": "fallback",
                "has_tables": tables_data.get("total_tables", 0) > 0
            }
        }
    
    # Keep existing methods from original code
    def _calculate_risk_score(self, extraction: Dict[str, Any]) -> float:
        """Calculate risk score based on extracted factors"""
        risk_score = 0.0
        
        # Check for high-risk clauses
        if extraction.get("clauses"):
            high_risk_clauses = ["indemnification", "liability", "termination", "penalty"]
            for clause in extraction["clauses"]:
                if any(risk_term in clause.lower() for risk_term in high_risk_clauses):
                    risk_score += 0.1
        
        # Check dates with better error handling
        dates = extraction.get("dates", {})
        if dates.get("expiration_date"):
            try:
                exp_date_str = dates["expiration_date"]
                # Handle various date formats
                if "T" in exp_date_str:
                    exp_date = datetime.fromisoformat(exp_date_str.replace('Z', '+00:00'))
                else:
                    # Handle date-only format (YYYY-MM-DD)
                    exp_date = datetime.strptime(exp_date_str, "%Y-%m-%d")
                
                days_remaining = (exp_date - datetime.now()).days
                if days_remaining < 90:  # Expiring soon
                    risk_score += 0.2
                if days_remaining < 30:  # Expiring very soon
                    risk_score += 0.3
            except Exception as e:
                print(f"Error parsing expiration date '{dates.get('expiration_date')}': {e}")
        
        # Check financial terms
        financial = extraction.get("financial", {})
        total_value = financial.get("total_value", 0)
        
        # Convert to float if it's a string
        if isinstance(total_value, str):
            try:
                # Remove commas and non-numeric characters
                total_value = float(''.join(filter(str.isdigit, total_value)))
            except:
                total_value = 0
        
        if total_value > 1000000:  # High value contract
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
        """Enhanced version comparison for amendments"""
        deltas = []
        
        # Define comparison strategies for different field types
        def compare_lists(old_list, new_list, field_name):
            """Compare lists and identify additions/removals"""
            if not old_list and not new_list:
                return []
            
            old_list = old_list or []
            new_list = new_list or []
            
            changes = []
            old_set = set(str(item) for item in old_list)
            new_set = set(str(item) for item in new_list)
            
            # Items removed
            for item in old_set - new_set:
                changes.append({
                    "field_name": f"{field_name}.removed",
                    "old_value": item,
                    "new_value": None,
                    "change_type": "removed"
                })
            
            # Items added
            for item in new_set - old_set:
                changes.append({
                    "field_name": f"{field_name}.added",
                    "old_value": None,
                    "new_value": item,
                    "change_type": "added"
                })
            
            return changes
        
        def compare_dicts(old_dict, new_dict, field_name):
            """Compare dictionaries recursively"""
            if not old_dict and not new_dict:
                return []
            
            old_dict = old_dict or {}
            new_dict = new_dict or {}
            
            changes = []
            all_keys = set(old_dict.keys()) | set(new_dict.keys())
            
            for key in all_keys:
                old_val = old_dict.get(key)
                new_val = new_dict.get(key)
                
                # Handle nested structures
                if isinstance(old_val, dict) and isinstance(new_val, dict):
                    nested_changes = compare_dicts(old_val, new_val, f"{field_name}.{key}")
                    changes.extend(nested_changes)
                elif isinstance(old_val, list) and isinstance(new_val, list):
                    list_changes = compare_lists(old_val, new_val, f"{field_name}.{key}")
                    changes.extend(list_changes)
                elif old_val != new_val:
                    changes.append({
                        "field_name": f"{field_name}.{key}",
                        "old_value": old_val,
                        "new_value": new_val,
                        "change_type": "modified" if old_val is not None and new_val is not None else "added" if new_val is not None else "removed"
                    })
            
            return changes
        
        # Compare all fields recursively
        def compare_all_fields(old_data, new_data, path=""):
            """Recursively compare all fields between two dictionaries"""
            if not old_data and not new_data:
                return []
            
            old_data = old_data or {}
            new_data = new_data or {}
            
            changes = []
            all_keys = set(old_data.keys()) | set(new_data.keys())
            
            for key in all_keys:
                current_path = f"{path}.{key}" if path else key
                old_val = old_data.get(key)
                new_val = new_data.get(key)
                
                # Skip metadata fields that shouldn't be compared
                if key in ['metadata', 'extracted_metadata', 'extraction_date', 'confidence_score', 'risk_score']:
                    continue
                
                if isinstance(old_val, dict) and isinstance(new_val, dict):
                    # Recursively compare dictionaries
                    nested_changes = compare_all_fields(old_val, new_val, current_path)
                    changes.extend(nested_changes)
                elif isinstance(old_val, list) and isinstance(new_val, list):
                    # Compare lists
                    list_changes = compare_lists(old_val, new_val, current_path)
                    changes.extend(list_changes)
                elif old_val != new_val:
                    # Simple value comparison
                    changes.append({
                        "field_name": current_path,
                        "old_value": old_val,
                        "new_value": new_val,
                        "change_type": "modified" if old_val is not None and new_val is not None else "added" if new_val is not None else "removed"
                    })
            
            return changes
        
        # Start comparison from root level
        deltas = compare_all_fields(old_extraction, new_extraction)
        
        # Filter out None values that are the same
        deltas = [delta for delta in deltas if delta["old_value"] != delta["new_value"]]
        
        # Generate a summary of changes
        summary_parts = []
        if deltas:
            summary_parts.append(f"Found {len(deltas)} changes")
            
            # Count by change type
            added = sum(1 for d in deltas if d["change_type"] == "added")
            removed = sum(1 for d in deltas if d["change_type"] == "removed")
            modified = sum(1 for d in deltas if d["change_type"] == "modified")
            
            if added:
                summary_parts.append(f"{added} additions")
            if removed:
                summary_parts.append(f"{removed} removals")
            if modified:
                summary_parts.append(f"{modified} modifications")
        
        summary = "No changes detected." if not deltas else f"Amendment analysis: {', '.join(summary_parts)}."
        
        # Calculate confidence change
        old_conf = old_extraction.get("confidence_score", 0.0)
        new_conf = new_extraction.get("confidence_score", 0.0)
        confidence_change = new_conf - old_conf
        
        return {
            "deltas": deltas[:50],  # Limit to 50 most important changes
            "summary": summary,
            "confidence_change": confidence_change,
            "statistics": {
                "total_changes": len(deltas),
                "added": sum(1 for d in deltas if d["change_type"] == "added"),
                "removed": sum(1 for d in deltas if d["change_type"] == "removed"),
                "modified": sum(1 for d in deltas if d["change_type"] == "modified")
            }
        }

    def extract_tables_from_text(self, text: str) -> Dict[str, Any]:
        """Extract table-like structures from text"""
        tables = {}
        
        # Common table patterns in contracts
        table_patterns = [
            r"(PAYMENT\s+SCHEDULE[\s\S]*?)(?=\n\n|\n[A-Z]|$)",
            r"(REPORTING\s+REQUIREMENTS[\s\S]*?)(?=\n\n|\n[A-Z]|$)",
            r"(DELIVERABLES[\s\S]*?)(?=\n\n|\n[A-Z]|$)",
            r"(MILESTONES[\s\S]*?)(?=\n\n|\n[A-Z]|$)",
            r"(SCHEDULE\s+[A-Z][\s\S]*?)(?=\n\n|\n[A-Z]|$)",
            r"(EXHIBIT\s+[A-Z][\s\S]*?)(?=\n\n|\n[A-Z]|$)"
        ]
        
        for pattern in table_patterns:
            matches = re.finditer(pattern, text, re.IGNORECASE)
            for match in matches:
                table_name = match.group(1).split('\n')[0].strip()
                table_content = match.group(1)
                tables[table_name] = table_content
        
        return tables

    def process_contract(self, file_content: bytes, metadata: Dict[str, Any] = None) -> Dict[str, Any]:
        """Main contract processing method - wraps process_contract_text"""
        try:
            print("Starting contract processing...")
            
            # Extract text from PDF
            print("Step 1: Extracting text from PDF...")
            text_result = self.extract_text_from_pdf(file_content)
            plain_text = text_result["text"]
            
            if len(plain_text.strip()) < 100:
                print("Warning: Very little text extracted, trying alternative extraction...")
                plain_text = self._fallback_text_extraction(file_content)
            
            print(f"Step 2: Text extraction complete ({len(plain_text)} characters)")
            
            # Extract tables using Camelot
            print("Step 3: Extracting tables...")
            tables_data = self.table_extractor.extract_tables_from_pdf(file_content)
            structured_tables = self.table_extractor.extract_structured_table_data(tables_data)
            
            # Prepare context for OpenAI
            print("Step 4: Preparing context for OpenAI...")
            context = self._prepare_llm_context(plain_text, structured_tables, tables_data)
            
            # Process with OpenAI
            print("Step 5: Processing with OpenAI...")
            llm_result = self._process_with_openai_simple(context)
            
            # Combine results
            print("Step 6: Combining results...")
            combined_result = self._combine_extractions(llm_result, structured_tables, tables_data)
            
            # Add metrics
            print("Step 7: Calculating metrics...")
            combined_result = self._add_metrics(combined_result, structured_tables)
            
            # Add metadata
            if metadata:
                combined_result["metadata"] = {
                    **combined_result.get("metadata", {}),
                    **metadata,
                    "processing_steps": ["text_extraction", "table_extraction", "llm_processing"],
                    "table_count": tables_data.get("total_tables", 0),
                    "page_count": text_result.get("page_count", 0),
                    "extraction_complete": True
                }
            
            print("Contract processing completed successfully!")
            return combined_result
            
        except Exception as e:
            print(f"Error in contract processing: {e}")
            import traceback
            traceback.print_exc()
            return self._get_enhanced_fallback_extraction(file_content)

    # def process_contract_text(self, text: str, metadata: Dict[str, Any] = None) -> Dict[str, Any]:
    #     """Process contract text with enhanced table extraction and chunking for large documents"""
    #     try:
    #         # Extract tables before sending to OpenAI
    #         extracted_tables = self.extract_tables_from_text(text)
            
    #         # Calculate approximate token count (rough estimate: 1 token ≈ 4 characters)
    #         approx_tokens = len(text) / 4
            
    #         # If text is too large, split into chunks
    #         if approx_tokens > 2000:  # Conservative threshold for GPT-4
    #             print(f"Document too large ({approx_tokens:.0f} estimated tokens), processing in chunks")
                
    #             # Split text into chunks of ~2000 tokens each (8000 characters)
    #             chunk_size = 6000
    #             chunks = []
    #             start = 0
                
    #             while start < len(text):
    #                 end = start + chunk_size
    #                 # Try to break at a paragraph or sentence boundary
    #                 if end < len(text):
    #                     # Look for paragraph break first
    #                     paragraph_break = text.rfind('\n\n', start, end)
    #                     if paragraph_break != -1 and paragraph_break > start:
    #                         end = paragraph_break
    #                     else:
    #                         # Look for sentence break
    #                         sentence_break = max(text.rfind('. ', start, end),
    #                                             text.rfind('? ', start, end),
    #                                             text.rfind('! ', start, end))
    #                         if sentence_break != -1 and sentence_break > start:
    #                             end = sentence_break + 1
                    
    #                 chunk = text[start:end].strip()
    #                 if chunk:
    #                     chunks.append(chunk)
    #                 start = end
                
    #             print(f"Split document into {len(chunks)} chunks")
                
    #             # Process each chunk and combine results
    #             all_extracted_data = []
    #             for i, chunk in enumerate(chunks):
    #                 print(f"Processing chunk {i+1}/{len(chunks)}")
                    
    #                 chunk_prompt = f"""Analyze this portion of a contract document (chunk {i+1} of {len(chunks)}).
    #                 Focus on extracting contractual elements from this specific section.
                    
    #                 Important tables found in full document: {list(extracted_tables.keys())}
                    
    #                 Document text: {chunk[:6000]}"""
                    
    #                 try:
    #                     # Simple OpenAI client
    #                     api_key = os.getenv("OPENAI_API_KEY")
    #                     if api_key:
    #                         client = OpenAI(api_key=api_key)
    #                         response = client.chat.completions.create(
    #                             model="gpt-4o-mini",
    #                             messages=[
    #                                 {"role": "system", "content": self.system_prompt},
    #                                 {"role": "user", "content": chunk_prompt}
    #                             ],
    #                             temperature=0.1,
    #                             max_tokens=1500,
    #                             response_format={"type": "json_object"}
    #                         )
                            
    #                         extracted = json.loads(response.choices[0].message.content)
    #                         all_extracted_data.append(extracted)
    #                     else:
    #                         print("No OpenAI API key found for chunk processing")
                            
    #                 except Exception as e:
    #                     print(f"Error processing chunk {i+1}: {str(e)}")
    #                     continue
                
    #             # Combine all extracted data intelligently
    #             combined_result = self._merge_chunk_extractions(all_extracted_data)
                
    #             # Add extracted tables to result
    #             if extracted_tables:
    #                 combined_result["tables_and_schedules"] = extracted_tables
                
    #             # Calculate risk score
    #             combined_result["risk_score"] = self._calculate_risk_score(combined_result)
                
    #             # Add metadata
    #             if metadata:
    #                 combined_result["metadata"] = {
    #                     **combined_result.get("metadata", {}),
    #                     **metadata,
    #                     "processing_method": "chunked",
    #                     "number_of_chunks": len(chunks)
    #                 }
                
    #             return combined_result
                
    #         else:
    #             # Original logic for smaller documents
    #             context = f"""
    #             Important: This contract contains tables and schedules. Extract ALL information including:
                
    #             Found Tables:
    #             {json.dumps(list(extracted_tables.keys()), indent=2)}
                
    #             Contract Text:
    #             {text[:12000]}  # Leave room for response
    #             """
                
    #             # Simple OpenAI client
    #             api_key = os.getenv("OPENAI_API_KEY")
    #             if not api_key:
    #                 print("No OpenAI API key found")
    #                 return self._get_fallback_extraction()
                
    #             client = OpenAI(api_key=api_key)
    #             response = client.chat.completions.create(
    #                 model="gpt-4o-mini",
    #                 messages=[
    #                     {"role": "system", "content": self.system_prompt},
    #                     {"role": "user", "content": context}
    #                 ],
    #                 temperature=0.1,
    #                 max_tokens=4000,
    #                 response_format={"type": "json_object"}
    #             )
                
    #             result = json.loads(response.choices[0].message.content)
                
    #             # Add extracted tables to result
    #             if extracted_tables:
    #                 result["tables_and_schedules"] = extracted_tables
                
    #             # Calculate risk score
    #             result["risk_score"] = self._calculate_risk_score(result)
                
    #             # Add metadata
    #             if metadata:
    #                 result["metadata"] = {**result.get("metadata", {}), **metadata}
                
    #             return result
                
    #     except Exception as e:
    #         print(f"Error processing contract: {e}")
    #         return self._get_fallback_extraction()

    def clean_db_values(data: Dict[str, Any]) -> Dict[str, Any]:
        """Clean data for database storage (remove NaN values from JSON fields)"""
        import math
        import json
        
        def clean_value(value):
            if isinstance(value, float):
                if math.isnan(value):
                    return None
                elif math.isinf(value):
                    return None
                return value
            elif isinstance(value, dict):
                cleaned = {}
                for k, v in value.items():
                    cleaned[k] = clean_value(v)
                return cleaned
            elif isinstance(value, list):
                return [clean_value(item) for item in value]
            elif value is None:
                return None
            else:
                # Try to handle string representations of NaN
                if isinstance(value, str):
                    if value.lower() in ['nan', 'inf', '-inf', 'infinity', '-infinity']:
                        return None
                return value
        
        cleaned_data = {}
        for key, value in data.items():
            if key in ['parties', 'signatories', 'contacts', 'clauses', 'key_fields', 
                    'extracted_metadata', 'extracted_tables_data', 'service_levels',
                    'deliverables', 'risk_factors']:
                # These are JSON fields, need special handling
                if value is None:
                    cleaned_data[key] = None
                elif isinstance(value, str):
                    try:
                        # Try to parse and clean JSON string
                        parsed = json.loads(value)
                        cleaned = clean_value(parsed)
                        cleaned_data[key] = json.dumps(cleaned, ensure_ascii=False)
                    except:
                        # If it's not valid JSON, keep as is
                        cleaned_data[key] = value
                else:
                    # Already a Python object, clean and serialize
                    cleaned = clean_value(value)
                    cleaned_data[key] = json.dumps(cleaned, ensure_ascii=False) if cleaned is not None else None
            else:
                # Non-JSON fields
                cleaned_data[key] = clean_value(value)
        
        return cleaned_data


    def _merge_chunk_extractions(self, chunk_results: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Merge multiple chunk extractions into a single comprehensive result"""
        if not chunk_results:
            return self._get_fallback_extraction()
        
        # Start with first chunk as base
        merged = chunk_results[0].copy()
        
        # Merge parties (unique)
        all_parties = set()
        for chunk in chunk_results:
            if "parties" in chunk and isinstance(chunk["parties"], list):
                all_parties.update(chunk["parties"])
        merged["parties"] = list(all_parties)
        
        # Merge dates (keep most specific)
        for chunk in chunk_results[1:]:
            if "dates" in chunk and isinstance(chunk["dates"], dict):
                for date_type, date_value in chunk["dates"].items():
                    if date_value and date_value != "Unknown":
                        if date_type not in merged["dates"] or merged["dates"][date_type] == "Unknown":
                            merged["dates"][date_type] = date_value
        
        # Merge financial data - FIXED: Handle string values properly
        for chunk in chunk_results[1:]:
            if "financial" in chunk and isinstance(chunk["financial"], dict):
                for financial_key, financial_value in chunk["financial"].items():
                    if financial_value:
                        # Skip comparison for non-numeric fields
                        if financial_key in ["currency", "payment_terms", "billing_frequency", "late_payment_fee", "advance_payment", "retention_amount"]:
                            if financial_key not in merged["financial"]:
                                merged["financial"][financial_key] = financial_value
                        else:
                            # For numeric fields (total_value), handle string to number conversion
                            if financial_key == "total_value":
                                try:
                                    # Convert current value to float if it exists
                                    current_val = merged["financial"].get(financial_key, 0)
                                    if isinstance(current_val, str):
                                        try:
                                            # Remove non-numeric characters and convert
                                            current_val_clean = ''.join(c for c in str(current_val) if c.isdigit() or c == '.')
                                            current_val = float(current_val_clean) if current_val_clean else 0
                                        except:
                                            current_val = 0
                                    
                                    # Convert new value to float
                                    new_val = financial_value
                                    if isinstance(new_val, str):
                                        try:
                                            # Remove non-numeric characters and convert
                                            new_val_clean = ''.join(c for c in str(new_val) if c.isdigit() or c == '.')
                                            new_val = float(new_val_clean) if new_val_clean else 0
                                        except:
                                            new_val = 0
                                    
                                    # Only update if new value is larger and valid
                                    if financial_key not in merged["financial"] or new_val > current_val:
                                        merged["financial"][financial_key] = financial_value  # Keep original value
                                except Exception as e:
                                    print(f"Error comparing financial value for {financial_key}: {e}")
                                    continue
                            else:
                                # For other financial fields, just take the first non-empty value
                                if financial_key not in merged["financial"]:
                                    merged["financial"][financial_key] = financial_value
        
        # Merge clauses
        all_clauses = {}
        for chunk in chunk_results:
            if "clauses" in chunk and isinstance(chunk["clauses"], dict):
                for clause_name, clause_data in chunk["clauses"].items():
                    if clause_name not in all_clauses or len(str(clause_data)) > len(str(all_clauses[clause_name])):
                        all_clauses[clause_name] = clause_data
        merged["clauses"] = all_clauses
        
        # Merge deliverables
        all_deliverables = []
        for chunk in chunk_results:
            if "deliverables" in chunk and isinstance(chunk["deliverables"], list):
                for deliverable in chunk["deliverables"]:
                    if deliverable not in all_deliverables:
                        all_deliverables.append(deliverable)
        merged["deliverables"] = all_deliverables
        
        # Update metadata
        merged["metadata"] = {
            "extraction_completeness": 0.95,
            "unstructured_content_preserved": True,
            "tables_extracted": len(merged.get("tables_and_schedules", {})),
            "sections_identified": len(all_clauses) + len(all_deliverables),
            "processing_method": "chunked_merge"
        }
        
        return merged

    def compare_text_content(self, old_text: str, new_text: str) -> Dict[str, Any]:
        """Compare raw text content for amendments using OpenAI"""
        try:
            prompt = f"""Compare these two contract versions and identify ALL changes between them.

            OLD VERSION:
            {old_text[:8000]}

            NEW VERSION (Amendment):
            {new_text[:8000]}

            Analyze and return ALL changes in this structured format:
            1. Added clauses (completely new text)
            2. Removed clauses (text deleted)
            3. Modified clauses (text changed)
            4. Changed dates, amounts, or other values
            5. Changed parties or signatories

            Return as JSON with this structure:
            {{
                "summary": "Brief summary of changes",
                "changes": [
                    {{
                        "type": "added|removed|modified",
                        "section": "Section name",
                        "description": "What changed",
                        "old_value": "Previous text/values",
                        "new_value": "New text/values"
                    }}
                ],
                "key_impacts": ["List key business impacts"],
                "recommendations": ["Review recommendations"]
            }}
            """
            
            # Simple OpenAI client
            api_key = os.getenv("OPENAI_API_KEY")
            if not api_key:
                print("No OpenAI API key found for text comparison")
                return {"summary": "Comparison requires OpenAI API key", "changes": []}
            
            client = OpenAI(api_key=api_key)
            
            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "You are a legal contract comparison expert. Analyze amendments thoroughly."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.1,
                max_tokens=3000,
                response_format={"type": "json_object"}
            )
            
            return json.loads(response.choices[0].message.content)
            
        except Exception as e:
            print(f"Error comparing text content: {e}")
            return {"summary": "Comparison failed", "changes": []}