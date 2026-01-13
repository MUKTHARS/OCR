
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
    
    def process_contract(self, file_content: bytes, metadata: Dict[str, Any] = None) -> Dict[str, Any]:
        """Enhanced contract processing with table extraction"""
        try:
            print("Starting enhanced contract processing...")
            
            # Step 1: Extract text from PDF
            print("Step 1: Extracting text from PDF...")
            text_result = self.extract_text_from_pdf(file_content)
            plain_text = text_result["text"]
            
            if len(plain_text.strip()) < 100:
                print("Warning: Very little text extracted, trying alternative extraction...")
                # Fallback extraction method
                plain_text = self._fallback_text_extraction(file_content)
            
            # Step 2: Extract tables using Camelot
            print("Step 2: Extracting tables with Camelot...")
            tables_data = self.table_extractor.extract_tables_from_pdf(file_content)
            
            # Step 3: Structure table data
            print("Step 3: Structuring table data...")
            structured_tables = self.table_extractor.extract_structured_table_data(tables_data)
            
            # Step 4: Prepare context for OpenAI
            print("Step 4: Preparing context for OpenAI...")
            context = self._prepare_llm_context(plain_text, structured_tables, tables_data)
            
            # Step 5: Process with OpenAI
            print("Step 5: Processing with OpenAI...")
            llm_result = self._process_with_openai_simple(context)
            
            # Step 6: Combine results
            print("Step 6: Combining results...")
            combined_result = self._combine_extractions(llm_result, structured_tables, tables_data)
            
            # Step 7: Calculate metrics
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
            print(f"Error in enhanced contract processing: {e}")
            import traceback
            traceback.print_exc()
            return self._get_enhanced_fallback_extraction(file_content)
    
    def _prepare_llm_context(self, plain_text: str, structured_tables: Dict, tables_data: Dict) -> str:
        """Prepare context for LLM processing"""
        # Truncate text if too long
        max_text_length = 10000
        if len(plain_text) > max_text_length:
            plain_text = plain_text[:max_text_length] + "... [truncated]"
        
        # Create table summary
        table_summary = "EXTRACTED TABLES DATA:\n\n"
        
        if structured_tables.get("payment_schedule"):
            table_summary += f"PAYMENT SCHEDULE ({len(structured_tables['payment_schedule'])} items):\n"
            for payment in structured_tables["payment_schedule"][:5]:  # Show first 5
                table_summary += f"  - {payment.get('description', 'N/A')}: {payment.get('amount', 'N/A')} due {payment.get('due_date', 'N/A')}\n"
        
        if structured_tables.get("deliverables"):
            table_summary += f"\nDELIVERABLES ({len(structured_tables['deliverables'])} items):\n"
            for deliverable in structured_tables["deliverables"][:5]:
                table_summary += f"  - {deliverable.get('item', 'N/A')}: Due {deliverable.get('due_date', 'N/A')}\n"
        
        if structured_tables.get("reporting_requirements"):
            table_summary += f"\nREPORTING REQUIREMENTS ({len(structured_tables['reporting_requirements'])} items):\n"
            for report in structured_tables["reporting_requirements"][:5]:
                table_summary += f"  - {report.get('type', 'N/A')}: {report.get('frequency', 'N/A')}\n"
        
        context = f"""
        CONTRACT TEXT:
        {plain_text}
        
        {table_summary}
        
        ADDITIONAL TABLES FOUND: {tables_data.get('total_tables', 0)} total tables
        TABLE TYPES: {', '.join(tables_data.get('tables_by_type', {}).keys())}
        
        INSTRUCTIONS:
        1. Extract all key information from the contract text above
        2. Use the provided table data to populate structured fields
        3. Focus on accuracy and completeness
        4. Return only valid JSON
        """
        
        return context

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

    def process_contract_text(self, text: str, metadata: Dict[str, Any] = None) -> Dict[str, Any]:
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
                        # Simple OpenAI client
                        api_key = os.getenv("OPENAI_API_KEY")
                        if api_key:
                            client = OpenAI(api_key=api_key)
                            response = client.chat.completions.create(
                                model="gpt-4o-mini",
                                messages=[
                                    {"role": "system", "content": self.system_prompt},
                                    {"role": "user", "content": chunk_prompt}
                                ],
                                temperature=0.1,
                                max_tokens=1500,
                                response_format={"type": "json_object"}
                            )
                            
                            extracted = json.loads(response.choices[0].message.content)
                            all_extracted_data.append(extracted)
                        else:
                            print("No OpenAI API key found for chunk processing")
                            
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
                
                # Simple OpenAI client
                api_key = os.getenv("OPENAI_API_KEY")
                if not api_key:
                    print("No OpenAI API key found")
                    return self._get_fallback_extraction()
                
                client = OpenAI(api_key=api_key)
                response = client.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=[
                        {"role": "system", "content": self.system_prompt},
                        {"role": "user", "content": context}
                    ],
                    temperature=0.1,
                    max_tokens=4000,
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