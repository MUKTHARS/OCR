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
        # Update the system prompt in ContractProcessor.__init__():

        self.system_prompt = """You are an Enterprise Contract Intelligence Agent. Extract ALL information from contracts.

        IMPORTANT EXTRACTIONS:
        1. Extract signatories with names, titles, and signatures
        2. Extract ALL parties with full legal names
        3. For each contract, ensure you extract:
           - All signatories (names, titles, signature dates)
           - Total contract value with currency
           - All parties involved
           - Contract type and subtype
           - Effective and expiration dates

        INSTRUCTIONS:
        1. Extract EVERY section, clause, term, and detail you find in the contract
        2. If something doesn't fit predefined categories, create new categories
        3. For tables (like payment schedules, deliverables, milestones), extract ALL data
        4. For dates, convert to YYYY-MM-DD format
        5. For monetary values, extract both amount and currency
        6. For parties, extract FULL legal names
        7. Preserve the original wording and structure when possible

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
                "notice_period_days": 30,
                "other_dates": {
                    "date_description": "YYYY-MM-DD"
                }
            },
            
            "financial": {
                "total_value": 100000,
                "currency": "USD",
                "payment_terms": "Net 30",
                "billing_frequency": "Monthly",
                "late_payment_fee": "1.5% per month",
                "advance_payment": 0.3,
                "retention_amount": 0.1,
                "other_financial_terms": {}
            },
            
            "payment_schedule": [
                {
                    "milestone": "Upon Signing",
                    "percentage": 30,
                    "amount": 30000,
                    "due_date": "YYYY-MM-DD",
                    "conditions": "None"
                }
            ],
            
            "deliverables": [
                {
                    "item": "Software Implementation",
                    "due_date": "YYYY-MM-DD",
                    "milestone": "Phase 1",
                    "acceptance_criteria": "Client sign-off",
                    "status": "Pending"
                }
            ],
            
            "service_levels": {
                "uptime": {
                    "target": "99.9%",
                    "measurement_period": "Monthly",
                    "remedies": "Service credit"
                }
            },
            
            "clauses": {
                "confidentiality": {
                    "text": "Full clause text here...",
                    "duration_years": 5,
                    "exceptions": "Public information",
                    "category": "Legal"
                },
                "indemnification": {
                    "text": "Full clause text here...",
                    "scope": "Third-party claims",
                    "limitations": "Direct damages only",
                    "category": "Risk"
                },
                "termination": {
                    "text": "Full clause text here...",
                    "notice_period": 30,
                    "causes": ["Breach", "Insolvency"],
                    "category": "Administrative"
                }
            },
            
            "tables_and_schedules": {
                "payment_schedule": "Full table text or structured data",
                "deliverables_schedule": "Full table text or structured data",
                "personnel_assignment": "Full table text or structured data"
            },
            
            "key_fields": {
                "contract_value": {
                    "value": "100,000 USD",
                    "data_type": "currency",
                    "confidence": 0.95,
                    "source_section": "Financial Terms"
                },
                "governing_law": {
                    "value": "State of Delaware",
                    "data_type": "text",
                    "confidence": 0.98,
                    "source_section": "Legal Provisions"
                }
            },
            
            "risk_indicators": {
                "auto_renewal": true,
                "unlimited_liability": false,
                "penalty_clauses": true,
                "confidentiality_period_years": 5,
                "termination_for_convenience": true
            },
            
            "compliance_requirements": {
                "insurance_required": true,
                "minimum_coverage": "1,000,000 USD",
                "audit_rights": true,
                "audit_frequency": "Annually",
                "reporting_requirements": ["Monthly", "Quarterly", "Annually"]
            },
            
            "contact_information": {
                "signatories": [
                    {
                        "name": "John Doe",
                        "title": "CEO",
                        "email": "john@company.com",
                        "signature_date": "YYYY-MM-DD"
                    }
                ],
                "administrative_contacts": [
                    {
                        "type": "Billing",
                        "name": "Jane Smith",
                        "email": "billing@company.com",
                        "phone": "+1-234-567-8900"
                    }
                ]
            },
            
            "attachments_and_exhibits": [
                {
                    "name": "Exhibit A - Scope of Work",
                    "reference": "Attached",
                    "description": "Detailed project scope"
                }
            ],
            
            "miscellaneous": {
                "document_version": "2.1",
                "number_of_pages": 25,
                "language": "English",
                "has_amendments": false,
                "amendment_history": []
            },
            
            "extracted_sections": {
                "section_name": {
                    "text": "Full section text",
                    "page_number": 5,
                    "category": "category",
                    "importance": "high/medium/low"
                }
            },
            
            "metadata": {
                "extraction_completeness": 0.95,
                "unstructured_content_preserved": true,
                "tables_extracted": 2,
                "sections_identified": 15
            },
            
            "confidence_score": 0.95,
            "risk_score": 0.3
        }

        IMPORTANT: 
        - Extract ALL tables, schedules, and attachments
        - If you see "REPORTING & PAYMENT SCHEDULE", extract it completely
        - For payment schedules, extract all rows with amounts, dates, and conditions
        - For reporting requirements, extract frequency, format, and recipients
        - Preserve original wording for complex clauses
        - Don't omit any information - include everything you find"""
    
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
    
    # def process_contract(self, text: str, metadata: Dict[str, Any] = None) -> Dict[str, Any]:
    #     """Process contract text using OpenAI with enhanced extraction"""
    #     try:
    #         # Prepare enhanced context
    #         context = f"""
    #         Document Metadata:
    #         - Pages: {metadata.get('page_count', 'Unknown') if metadata else 'Unknown'}
    #         - Extraction Quality: {'High' if len(text) > 1000 else 'Low'}
            
    #         Contract Text:
    #         {text[:20000]}  # Increased limit for detailed extraction
    #         """
            
    #         response = client.chat.completions.create(
    #             model="gpt-4-turbo-preview",
    #             messages=[
    #                 {"role": "system", "content": self.system_prompt},
    #                 {"role": "user", "content": context}
    #             ],
    #             temperature=0.1,
    #             max_tokens=4000,
    #             response_format={"type": "json_object"}
    #         )
            
    #         result = json.loads(response.choices[0].message.content)
            
    #         # Calculate risk score based on extracted factors
    #         result["risk_score"] = self._calculate_risk_score(result)
            
    #         # Add metadata
    #         if metadata:
    #             result["metadata"] = {**result.get("metadata", {}), **metadata}
            
    #         return result
            
    #     except Exception as e:
    #         print(f"Error processing contract: {e}")
    #         return self._get_fallback_extraction()
    
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
            try:
                exp_date = datetime.fromisoformat(dates["expiration_date"].replace('Z', '+00:00'))
                days_remaining = (exp_date - datetime.now()).days
                if days_remaining < 90:  # Expiring soon
                    risk_score += 0.2
                if days_remaining < 30:  # Expiring very soon
                    risk_score += 0.3
            except Exception as e:
                print(f"Error parsing expiration date: {e}")
        
        # Check financial terms - FIXED: Handle string values
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

    def process_contract(self, text: str, metadata: Dict[str, Any] = None) -> Dict[str, Any]:
        """Process contract text with enhanced table extraction and chunking for large documents"""
        try:
            # Extract tables before sending to OpenAI
            extracted_tables = self.extract_tables_from_text(text)
            
            # Calculate approximate token count (rough estimate: 1 token ≈ 4 characters)
            approx_tokens = len(text) / 4
            
            # If text is too large, split into chunks
            if approx_tokens > 2000:  # Conservative threshold for GPT-4
                print(f"Document too large ({approx_tokens:.0f} estimated tokens), processing in chunks")
                
                # Split text into chunks of ~2000 tokens each (8000 characters)
                chunk_size = 6000
                chunks = []
                start = 0
                
                while start < len(text):
                    end = start + chunk_size
                    # Try to break at a paragraph or sentence boundary
                    if end < len(text):
                        # Look for paragraph break first
                        paragraph_break = text.rfind('\n\n', start, end)
                        if paragraph_break != -1 and paragraph_break > start:
                            end = paragraph_break
                        else:
                            # Look for sentence break
                            sentence_break = max(text.rfind('. ', start, end),
                                                text.rfind('? ', start, end),
                                                text.rfind('! ', start, end))
                            if sentence_break != -1 and sentence_break > start:
                                end = sentence_break + 1
                    
                    chunk = text[start:end].strip()
                    if chunk:
                        chunks.append(chunk)
                    start = end
                
                print(f"Split document into {len(chunks)} chunks")
                
                # Process each chunk and combine results
                all_extracted_data = []
                for i, chunk in enumerate(chunks):
                    print(f"Processing chunk {i+1}/{len(chunks)}")
                    
                    chunk_prompt = f"""Analyze this portion of a contract document (chunk {i+1} of {len(chunks)}).
                    Focus on extracting contractual elements from this specific section.
                    
                    Important tables found in full document: {list(extracted_tables.keys())}
                    
                    Document text: {chunk[:6000]}"""
                    
                    try:
                        response = client.chat.completions.create(
                            model="gpt-4-turbo-preview",
                            messages=[
                                {"role": "system", "content": self.system_prompt},
                                {"role": "user", "content": chunk_prompt}
                            ],
                            temperature=0.1,
                            max_tokens=1500,  # Conservative for chunks
                            response_format={"type": "json_object"}
                        )
                        
                        extracted = json.loads(response.choices[0].message.content)
                        all_extracted_data.append(extracted)
                        
                    except Exception as e:
                        print(f"Error processing chunk {i+1}: {str(e)}")
                        continue
                
                # Combine all extracted data intelligently
                combined_result = self._merge_chunk_extractions(all_extracted_data)
                
                # Add extracted tables to result
                if extracted_tables:
                    combined_result["tables_and_schedules"] = extracted_tables
                
                # Calculate risk score
                combined_result["risk_score"] = self._calculate_risk_score(combined_result)
                
                # Add metadata
                if metadata:
                    combined_result["metadata"] = {
                        **combined_result.get("metadata", {}),
                        **metadata,
                        "processing_method": "chunked",
                        "number_of_chunks": len(chunks)
                    }
                
                return combined_result
                
            else:
                # Original logic for smaller documents
                context = f"""
                Important: This contract contains tables and schedules. Extract ALL information including:
                
                Found Tables:
                {json.dumps(list(extracted_tables.keys()), indent=2)}
                
                Contract Text:
                {text[:12000]}  # Leave room for response
                """
                
                response = client.chat.completions.create(
                    model="gpt-4-turbo-preview",
                    messages=[
                        {"role": "system", "content": self.system_prompt},
                        {"role": "user", "content": context}
                    ],
                    temperature=0.1,
                    max_tokens=4000,  # Increased for detailed extraction
                    response_format={"type": "json_object"}
                )
                
                result = json.loads(response.choices[0].message.content)
                
                # Add extracted tables to result
                if extracted_tables:
                    result["tables_and_schedules"] = extracted_tables
                
                # Calculate risk score
                result["risk_score"] = self._calculate_risk_score(result)
                
                # Add metadata
                if metadata:
                    result["metadata"] = {**result.get("metadata", {}), **metadata}
                
                return result
                
        except Exception as e:
            print(f"Error processing contract: {e}")
            return self._get_fallback_extraction()

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
            
            response = client.chat.completions.create(
                model="gpt-4-turbo-preview",
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