import camelot
import pandas as pd
import json
import numpy as np
from typing import Dict, List, Any, Optional, Tuple
import PyPDF2
from io import BytesIO
import re
import hashlib

class TableExtractor:
    def __init__(self):
        self.table_cache = {}

    def extract_tables_from_pdf(self, file_content: bytes) -> Dict[str, Any]:
        """Extract tables from PDF using Camelot with CORRECT parameters"""
        tables_data = {
            "tables": [],
            "total_tables": 0
        }
        
        try:
            # Save PDF to BytesIO for Camelot
            pdf_file = BytesIO(file_content)
            
            print("Attempting table extraction with Camelot...")
            
            # Try different approaches
            extraction_methods = [
                {"method": "lattice", "params": {"pages": "all", "strip_text": "\n"}},
                {"method": "stream", "params": {"pages": "all", "strip_text": "\n"}},
            ]
            
            all_tables = []
            
            for method_config in extraction_methods:
                try:
                    print(f"Trying {method_config['method']} extraction...")
                    
                    if method_config['method'] == 'lattice':
                        tables = camelot.read_pdf(
                            pdf_file,
                            flavor='lattice',
                            pages=method_config['params'].get('pages', 'all'),
                            strip_text=method_config['params'].get('strip_text', '\n')
                        )
                    else:  # stream
                        tables = camelot.read_pdf(
                            pdf_file,
                            flavor='stream',
                            pages=method_config['params'].get('pages', 'all'),
                            strip_text=method_config['params'].get('strip_text', '\n'),
                            edge_tol=500,
                            row_tol=10
                        )
                    
                    if tables:
                        print(f"Found {len(tables)} tables with {method_config['method']} flavor")
                        all_tables.extend(tables)
                        
                except Exception as method_error:
                    print(f"Extraction with {method_config['method']} failed: {method_error}")
                    continue
            
            # Remove duplicate tables (by page and order)
            unique_tables = []
            seen_locations = set()
            
            for table in all_tables:
                location_key = f"{table.page}_{table.order}"
                if location_key not in seen_locations:
                    seen_locations.add(location_key)
                    unique_tables.append(table)
            
            print(f"Total unique tables found: {len(unique_tables)}")
            
            for i, table in enumerate(unique_tables):
                try:
                    # Convert table to structured data
                    df = table.df
                    
                    # Clean the dataframe
                    df = self._clean_dataframe(df)
                    
                    # Only include tables with meaningful data
                    if len(df) > 0 and len(df.columns) > 0 and not df.empty:
                        table_info = {
                            "table_index": i,
                            "page": table.page,
                            "accuracy": table.accuracy,
                            "whitespace": table.whitespace,
                            "order": table.order,
                            "data": df.to_dict(orient='records'),
                            "columns": df.columns.tolist(),
                            "row_count": len(df),
                            "col_count": len(df.columns),
                            "flavor": table.flavor,
                            "raw_data": df.to_dict(orient='split')
                        }
                        
                        # Try to detect table type
                        table_info["type"] = self._detect_table_type(df, table.page)
                        
                        tables_data["tables"].append(table_info)
                        print(f"  - Table {i+1}: {table_info['type']} ({len(df)} rows, {len(df.columns)} cols)")
                        
                except Exception as e:
                    print(f"Error processing table {i}: {e}")
                    continue
            
            tables_data["total_tables"] = len(tables_data["tables"])
            
            # Group tables by type
            if tables_data["tables"]:
                tables_data["tables_by_type"] = self._group_tables_by_type(tables_data["tables"])
            else:
                tables_data["tables_by_type"] = {}
            
            print(f"Successfully extracted {tables_data['total_tables']} tables")
            
        except Exception as e:
            print(f"Error extracting tables: {e}")
            import traceback
            traceback.print_exc()
            tables_data["error"] = str(e)
        
        return tables_data

    # def extract_tables_from_pdf(self, file_content: bytes) -> Dict[str, Any]:
    #     """Extract tables from PDF using Camelot with correct parameters"""
    #     tables_data = {
    #         "tables": [],
    #         "flavor": "auto",
    #         "total_tables": 0
    #     }
        
    #     try:
    #         # Save PDF to BytesIO for Camelot
    #         pdf_file = BytesIO(file_content)
            
    #         # Try multiple extraction methods with CORRECT parameters for each flavor
    #         extraction_methods = [
    #             {
    #                 "flavor": "lattice", 
    #                 "pages": "all", 
    #                 "line_scale": 40,
    #                 "suppress_stdout": True
    #             },
    #             {
    #                 "flavor": "stream", 
    #                 "pages": "all", 
    #                 "strip_text": "\n",
    #                 "edge_tol": 500,
    #                 "row_tol": 10,
    #                 "suppress_stdout": True
    #             }
    #         ]
            
    #         all_tables = []
            
    #         for method_config in extraction_methods:
    #             try:
    #                 print(f"Trying extraction with {method_config['flavor']} flavor...")
                    
    #                 # Separate parameters by flavor
    #                 if method_config["flavor"] == "lattice":
    #                     tables = camelot.read_pdf(
    #                         pdf_file,
    #                         pages=method_config.get("pages", "all"),
    #                         flavor="lattice",
    #                         line_scale=method_config.get("line_scale", 40),
    #                         suppress_stdout=method_config.get("suppress_stdout", True)
    #                     )
    #                 else:  # stream flavor
    #                     tables = camelot.read_pdf(
    #                         pdf_file,
    #                         pages=method_config.get("pages", "all"),
    #                         flavor="stream",
    #                         strip_text=method_config.get("strip_text", "\n"),
    #                         edge_tol=method_config.get("edge_tol", 50),
    #                         row_tol=method_config.get("row_tol", 2),
    #                         suppress_stdout=method_config.get("suppress_stdout", True)
    #                     )
                    
    #                 if tables:
    #                     all_tables.extend(tables)
    #                     print(f"Found {len(tables)} tables with {method_config['flavor']} flavor")
                        
    #             except Exception as method_error:
    #                 print(f"Extraction with {method_config['flavor']} failed: {method_error}")
    #                 continue
            
    #         # Remove duplicate tables (by page and approximate position)
    #         unique_tables = []
    #         seen_locations = set()
            
    #         for table in all_tables:
    #             location_key = f"{table.page}_{table.order}"
    #             if location_key not in seen_locations:
    #                 seen_locations.add(location_key)
    #                 unique_tables.append(table)
            
    #         print(f"Total unique tables found: {len(unique_tables)}")
            
    #         for i, table in enumerate(unique_tables):
    #             try:
    #                 # Convert table to structured data
    #                 df = table.df
                    
    #                 # Clean the dataframe
    #                 df = self._clean_dataframe(df)
                    
    #                 # Only include tables with meaningful data
    #                 if len(df) > 0 and len(df.columns) > 0:
    #                     table_info = {
    #                         "table_index": i,
    #                         "page": table.page,
    #                         "accuracy": table.accuracy,
    #                         "whitespace": table.whitespace,
    #                         "order": table.order,
    #                         "data": df.to_dict(orient='records'),
    #                         "columns": df.columns.tolist(),
    #                         "row_count": len(df),
    #                         "col_count": len(df.columns),
    #                         "flavor": table.flavor,
    #                         "raw_data": df.to_dict(orient='split')
    #                     }
                        
    #                     # Try to detect table type
    #                     table_info["type"] = self._detect_table_type(df, table.page)
                        
    #                     tables_data["tables"].append(table_info)
                        
    #             except Exception as e:
    #                 print(f"Error processing table {i}: {e}")
    #                 continue
            
    #         tables_data["total_tables"] = len(tables_data["tables"])
            
    #         # Group tables by type
    #         tables_data["tables_by_type"] = self._group_tables_by_type(tables_data["tables"])
            
    #         print(f"Successfully extracted {tables_data['total_tables']} tables")
            
    #     except Exception as e:
    #         print(f"Error extracting tables: {e}")
    #         import traceback
    #         traceback.print_exc()
    #         tables_data["error"] = str(e)
        
    #     return tables_data

    # def extract_tables_from_pdf(self, file_content: bytes) -> Dict[str, Any]:
    #     """Extract tables from PDF using Camelot with better configuration"""
    #     tables_data = {
    #         "tables": [],
    #         "flavor": "lattice",  # Changed to lattice for better accuracy
    #         "total_tables": 0
    #     }
        
    #     try:
    #         # Save PDF to BytesIO for Camelot
    #         pdf_file = BytesIO(file_content)
            
    #         # Try multiple extraction methods with better parameters
    #         extraction_methods = [
    #             {"flavor": "lattice", "pages": "all", "line_scale": 40},
    #             {"flavor": "stream", "pages": "all", "strip_text": "\n", "edge_tol": 500},
    #             {"flavor": "stream", "pages": "all", "strip_text": "\n", "row_tol": 10}
    #         ]
            
    #         all_tables = []
            
    #         for method_config in extraction_methods:
    #             try:
    #                 print(f"Trying extraction with {method_config['flavor']} flavor...")
    #                 tables = camelot.read_pdf(
    #                     pdf_file,
    #                     pages=method_config.get("pages", "all"),
    #                     flavor=method_config.get("flavor", "lattice"),
    #                     strip_text=method_config.get("strip_text", "\n"),
    #                     line_scale=method_config.get("line_scale", 40),
    #                     edge_tol=method_config.get("edge_tol", 50),
    #                     row_tol=method_config.get("row_tol", 2),
    #                     suppress_stdout=True  # Suppress warnings
    #                 )
                    
    #                 if tables:
    #                     all_tables.extend(tables)
    #                     print(f"Found {len(tables)} tables with {method_config['flavor']} flavor")
                        
    #             except Exception as method_error:
    #                 print(f"Extraction with {method_config['flavor']} failed: {method_error}")
    #                 continue
            
    #         # Remove duplicate tables (by page and approximate position)
    #         unique_tables = []
    #         seen_locations = set()
            
    #         for table in all_tables:
    #             location_key = f"{table.page}_{table.order}"
    #             if location_key not in seen_locations:
    #                 seen_locations.add(location_key)
    #                 unique_tables.append(table)
            
    #         print(f"Total unique tables found: {len(unique_tables)}")
            
    #         for i, table in enumerate(unique_tables):
    #             try:
    #                 # Convert table to structured data
    #                 df = table.df
                    
    #                 # Clean the dataframe
    #                 df = self._clean_dataframe(df)
                    
    #                 # Only include tables with meaningful data
    #                 if len(df) > 0 and len(df.columns) > 0:
    #                     table_info = {
    #                         "table_index": i,
    #                         "page": table.page,
    #                         "accuracy": table.accuracy,
    #                         "whitespace": table.whitespace,
    #                         "order": table.order,
    #                         "data": df.to_dict(orient='records'),
    #                         "columns": df.columns.tolist(),
    #                         "row_count": len(df),
    #                         "col_count": len(df.columns),
    #                         "flavor": table.flavor,
    #                         "raw_data": df.to_dict(orient='split')
    #                     }
                        
    #                     # Try to detect table type
    #                     table_info["type"] = self._detect_table_type(df, table.page)
                        
    #                     tables_data["tables"].append(table_info)
                        
    #             except Exception as e:
    #                 print(f"Error processing table {i}: {e}")
    #                 continue
            
    #         tables_data["total_tables"] = len(tables_data["tables"])
            
    #         # Group tables by type
    #         tables_data["tables_by_type"] = self._group_tables_by_type(tables_data["tables"])
            
    #         print(f"Successfully extracted {tables_data['total_tables']} tables")
            
    #     except Exception as e:
    #         print(f"Error extracting tables: {e}")
    #         import traceback
    #         traceback.print_exc()
    #         tables_data["error"] = str(e)
        
    #     return tables_data
    
    
    # def extract_tables_from_pdf(self, file_content: bytes) -> Dict[str, Any]:
    #     """Extract tables from PDF using Camelot"""
    #     tables_data = {
    #         "tables": [],
    #         "flavor": "stream",
    #         "total_tables": 0
    #     }
        
    #     try:
    #         # Save PDF to BytesIO for Camelot
    #         pdf_file = BytesIO(file_content)
            
    #         # Try stream flavor first (more reliable)
    #         try:
    #             tables = camelot.read_pdf(
    #                 pdf_file, 
    #                 pages='all', 
    #                 flavor='stream',
    #                 strip_text='\n'
    #             )
    #         except Exception as stream_error:
    #             print(f"Stream extraction failed: {stream_error}")
    #             try:
    #                 # Fallback to lattice
    #                 tables = camelot.read_pdf(
    #                     pdf_file, 
    #                     pages='all', 
    #                     flavor='lattice',
    #                     strip_text='\n'
    #                 )
    #             except Exception as lattice_error:
    #                 print(f"Lattice extraction also failed: {lattice_error}")
    #                 tables = []
            
    #         print(f"Found {len(tables)} tables in document")
            
    #         for i, table in enumerate(tables):
    #             try:
    #                 # Convert table to structured data
    #                 df = table.df
                    
    #                 # Clean the dataframe
    #                 df = self._clean_dataframe(df)
                    
    #                 table_info = {
    #                     "table_index": i,
    #                     "page": table.page,
    #                     "accuracy": table.accuracy,
    #                     "whitespace": table.whitespace,
    #                     "order": table.order,
    #                     "data": df.to_dict(orient='records'),
    #                     "columns": df.columns.tolist(),
    #                     "row_count": len(df),
    #                     "col_count": len(df.columns),
    #                     "flavor": table.flavor,
    #                     "raw_data": df.to_dict(orient='split')
    #                 }
                    
    #                 # Try to detect table type
    #                 table_info["type"] = self._detect_table_type(df, table.page)
                    
    #                 tables_data["tables"].append(table_info)
                    
    #             except Exception as e:
    #                 print(f"Error processing table {i}: {e}")
    #                 continue
            
    #         tables_data["total_tables"] = len(tables_data["tables"])
            
    #         # Group tables by type
    #         tables_data["tables_by_type"] = self._group_tables_by_type(tables_data["tables"])
            
    #     except Exception as e:
    #         print(f"Error extracting tables: {e}")
    #         tables_data["error"] = str(e)
        
    #     return tables_data
    
    def _clean_dataframe(self, df: pd.DataFrame) -> pd.DataFrame:
        """Clean and normalize dataframe"""
        # Remove empty rows and columns
        df = df.replace('', pd.NA)
        df = df.dropna(how='all').reset_index(drop=True)
        df = df.loc[:, ~df.isna().all()]
        
        # Clean cell values - use map instead of deprecated applymap
        df = df.map(lambda x: str(x).strip() if pd.notna(x) else '')
        
        # Normalize column names
        if len(df.columns) > 0:
            # Use first row as header if it looks like a header
            first_row = df.iloc[0].astype(str).str.lower()
            if first_row.str.contains('description|amount|date|schedule|payment|deliverable').any():
                df.columns = df.iloc[0]
                df = df[1:].reset_index(drop=True)
            
            # Clean column names
            df.columns = [str(col).strip() for col in df.columns]
        
        return df
    
    def _detect_table_type(self, df: pd.DataFrame, page: int) -> str:
        """Detect the type of table based on content"""
        if len(df) == 0:
            return "unknown"
        
        # Convert to string for pattern matching
        df_str = df.astype(str).to_string().lower()
        
        patterns = {
            "payment_schedule": ["payment", "amount", "due date", "schedule", "installment", "milestone"],
            "deliverables": ["deliverable", "milestone", "deadline", "completion", "acceptance"],
            "budget": ["budget", "cost", "amount", "category", "line item", "expense"],
            "reporting": ["report", "frequency", "format", "submission", "deadline"],
            "personnel": ["name", "title", "role", "hours", "rate", "personnel"],
            "signatories": ["signature", "signed", "executed", "witness", "notary", "date"],
            "compliance": ["requirement", "compliance", "regulation", "standard", "certification"],
            "risk_assessment": ["risk", "probability", "impact", "mitigation", "score"],
        }
        
        for table_type, keywords in patterns.items():
            if any(keyword in df_str for keyword in keywords):
                return table_type
        
        return "general"
    
    def _group_tables_by_type(self, tables: List[Dict]) -> Dict[str, List]:
        """Group tables by detected type"""
        grouped = {}
        for table in tables:
            table_type = table.get("type", "unknown")
            if table_type not in grouped:
                grouped[table_type] = []
            grouped[table_type].append(table)
        return grouped
    
    def extract_structured_table_data(self, tables_data: Dict) -> Dict[str, Any]:
        """Convert extracted tables to structured contract data"""
        structured_data = {
            "payment_schedule": [],
            "deliverables": [],
            "budget": [],
            "reporting_requirements": [],
            "personnel": [],
            "signatories": [],
            "compliance": [],
            "other_tables": []
        }
        
        for table in tables_data.get("tables", []):
            table_type = table.get("type", "unknown")
            data = table.get("data", [])
            
            if table_type == "payment_schedule":
                structured_data["payment_schedule"] = self._parse_payment_schedule(data)
            elif table_type == "deliverables":
                structured_data["deliverables"] = self._parse_deliverables(data)
            elif table_type == "budget":
                structured_data["budget"] = self._parse_budget(data)
            elif table_type == "reporting":
                structured_data["reporting_requirements"] = self._parse_reporting(data)
            elif table_type == "personnel":
                structured_data["personnel"] = self._parse_personnel(data)
            elif table_type == "signatories":
                structured_data["signatories"] = self._parse_signatories(data)
            elif table_type == "compliance":
                structured_data["compliance"] = self._parse_compliance(data)
            else:
                structured_data["other_tables"].append({
                    "type": table_type,
                    "data": data,
                    "metadata": {
                        "page": table.get("page"),
                        "accuracy": table.get("accuracy")
                    }
                })
        
        return structured_data
    
    def _parse_payment_schedule(self, data: List[Dict]) -> List[Dict]:
        """Parse payment schedule table"""
        payments = []
        
        for i, row in enumerate(data):
            try:
                payment = {
                    "id": f"payment_{i+1}",
                    "description": row.get("Description", row.get("Milestone", "")),
                    "amount": self._extract_amount(row.get("Amount", "")),
                    "due_date": self._extract_date(row.get("Due Date", row.get("Date", ""))),
                    "percentage": self._extract_percentage(row.get("Percentage", "")),
                    "status": "pending",
                    "conditions": row.get("Conditions", row.get("Remarks", ""))
                }
                
                # Clean up empty values
                payment = {k: v for k, v in payment.items() if v not in [None, "", 0]}
                if payment.get("amount") or payment.get("description"):
                    payments.append(payment)
                    
            except Exception as e:
                print(f"Error parsing payment row {i}: {e}")
                continue
        
        return payments
    
    def _parse_deliverables(self, data: List[Dict]) -> List[Dict]:
        """Parse deliverables table"""
        deliverables = []
        
        for i, row in enumerate(data):
            try:
                deliverable = {
                    "id": f"deliverable_{i+1}",
                    "item": row.get("Deliverable", row.get("Item", row.get("Description", ""))),
                    "due_date": self._extract_date(row.get("Due Date", row.get("Deadline", ""))),
                    "milestone": row.get("Milestone", ""),
                    "acceptance_criteria": row.get("Acceptance Criteria", row.get("Criteria", "")),
                    "status": "pending",
                    "owner": row.get("Owner", row.get("Responsible", ""))
                }
                
                # Clean up empty values
                deliverable = {k: v for k, v in deliverable.items() if v not in [None, "", 0]}
                if deliverable.get("item"):
                    deliverables.append(deliverable)
                    
            except Exception as e:
                print(f"Error parsing deliverable row {i}: {e}")
                continue
        
        return deliverables
    
    def _parse_budget(self, data: List[Dict]) -> List[Dict]:
        """Parse budget table"""
        budget_items = []
        
        for i, row in enumerate(data):
            try:
                budget_item = {
                    "id": f"budget_{i+1}",
                    "category": row.get("Category", row.get("Description", "")),
                    "amount": self._extract_amount(row.get("Amount", row.get("Budget", ""))),
                    "actual": self._extract_amount(row.get("Actual", "")),
                    "variance": self._extract_amount(row.get("Variance", "")),
                    "notes": row.get("Notes", row.get("Remarks", ""))
                }
                
                # Clean up empty values
                budget_item = {k: v for k, v in budget_item.items() if v not in [None, "", 0]}
                if budget_item.get("category"):
                    budget_items.append(budget_item)
                    
            except Exception as e:
                print(f"Error parsing budget row {i}: {e}")
                continue
        
        return budget_items
    
    def _parse_reporting(self, data: List[Dict]) -> List[Dict]:
        """Parse reporting requirements table"""
        reporting = []
        
        for i, row in enumerate(data):
            try:
                report = {
                    "id": f"report_{i+1}",
                    "type": row.get("Report Type", row.get("Type", "")),
                    "frequency": row.get("Frequency", ""),
                    "due_date": self._extract_date(row.get("Due Date", "")),
                    "format": row.get("Format", ""),
                    "recipient": row.get("Recipient", row.get("To", "")),
                    "purpose": row.get("Purpose", row.get("Description", ""))
                }
                
                # Clean up empty values
                report = {k: v for k, v in report.items() if v not in [None, "", 0]}
                if report.get("type"):
                    reporting.append(report)
                    
            except Exception as e:
                print(f"Error parsing report row {i}: {e}")
                continue
        
        return reporting
    
    def _parse_personnel(self, data: List[Dict]) -> List[Dict]:
        """Parse personnel table"""
        personnel = []
        
        for i, row in enumerate(data):
            try:
                person = {
                    "id": f"personnel_{i+1}",
                    "name": row.get("Name", ""),
                    "title": row.get("Title", row.get("Position", "")),
                    "role": row.get("Role", ""),
                    "hours": self._extract_number(row.get("Hours", "")),
                    "rate": self._extract_amount(row.get("Rate", "")),
                    "total": self._extract_amount(row.get("Total", "")),
                    "organization": row.get("Organization", row.get("Company", ""))
                }
                
                # Clean up empty values
                person = {k: v for k, v in person.items() if v not in [None, "", 0]}
                if person.get("name"):
                    personnel.append(person)
                    
            except Exception as e:
                print(f"Error parsing personnel row {i}: {e}")
                continue
        
        return personnel
    
    def _parse_signatories(self, data: List[Dict]) -> List[Dict]:
        """Parse signatories table"""
        signatories = []
        
        for i, row in enumerate(data):
            try:
                signatory = {
                    "id": f"signatory_{i+1}",
                    "name": row.get("Name", ""),
                    "title": row.get("Title", row.get("Position", "")),
                    "company": row.get("Company", row.get("Organization", "")),
                    "signature_date": self._extract_date(row.get("Date", row.get("Signature Date", ""))),
                    "email": row.get("Email", ""),
                    "phone": row.get("Phone", "")
                }
                
                # Clean up empty values
                signatory = {k: v for k, v in signatory.items() if v not in [None, "", 0]}
                if signatory.get("name"):
                    signatories.append(signatory)
                    
            except Exception as e:
                print(f"Error parsing signatory row {i}: {e}")
                continue
        
        return signatories
    
    def _parse_compliance(self, data: List[Dict]) -> List[Dict]:
        """Parse compliance requirements table"""
        compliance = []
        
        for i, row in enumerate(data):
            try:
                requirement = {
                    "id": f"compliance_{i+1}",
                    "requirement": row.get("Requirement", row.get("Standard", "")),
                    "description": row.get("Description", ""),
                    "deadline": self._extract_date(row.get("Deadline", row.get("Due Date", ""))),
                    "status": row.get("Status", ""),
                    "owner": row.get("Owner", row.get("Responsible", ""))
                }
                
                # Clean up empty values
                requirement = {k: v for k, v in requirement.items() if v not in [None, "", 0]}
                if requirement.get("requirement"):
                    compliance.append(requirement)
                    
            except Exception as e:
                print(f"Error parsing compliance row {i}: {e}")
                continue
        
        return compliance
    
    def _extract_amount(self, text: str) -> Optional[float]:
        """Extract numeric amount from text"""
        if not text:
            return None
        
        # Remove currency symbols and commas
        text = str(text).replace('$', '').replace(',', '').replace('€', '').replace('£', '')
        
        # Extract numbers with optional decimal
        match = re.search(r'(\d+(?:\.\d+)?)', text)
        if match:
            try:
                return float(match.group(1))
            except:
                return None
        return None
    
    def _extract_date(self, text: str) -> Optional[str]:
        """Extract and normalize date from text"""
        if not text:
            return None
        
        # Try to parse common date formats
        date_patterns = [
            r'(\d{4}-\d{2}-\d{2})',  # YYYY-MM-DD
            r'(\d{2}/\d{2}/\d{4})',  # MM/DD/YYYY
            r'(\d{2}-\d{2}-\d{4})',  # DD-MM-YYYY
            r'(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4})',  # 01 Jan 2024
        ]
        
        for pattern in date_patterns:
            match = re.search(pattern, str(text), re.IGNORECASE)
            if match:
                return match.group(1)
        
        return None
    
    def _extract_percentage(self, text: str) -> Optional[float]:
        """Extract percentage from text"""
        if not text:
            return None
        
        match = re.search(r'(\d+(?:\.\d+)?)\s*%', str(text))
        if match:
            try:
                return float(match.group(1))
            except:
                return None
        return None
    
    def _extract_number(self, text: str) -> Optional[float]:
        """Extract any number from text"""
        if not text:
            return None
        
        match = re.search(r'(\d+(?:\.\d+)?)', str(text))
        if match:
            try:
                return float(match.group(1))
            except:
                return None
        return None