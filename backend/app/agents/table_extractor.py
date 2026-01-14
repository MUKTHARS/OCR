import camelot
import pandas as pd
import json
from typing import Dict, Any, List
import traceback
import pdfplumber
import numpy as np

class TableExtractor:
    def __init__(self):
        pass
    
    def extract_tables_from_pdf(self, file_content: bytes) -> Dict[str, Any]:
        """Enhanced table extraction with multiple methods"""
        try:
            print("Attempting enhanced table extraction...")
            
            # Save to temp file for Camelot
            import tempfile
            import os
            
            all_tables = []
            methods_used = []
            
            # Method 1: Camelot with temp file
            try:
                print("Trying Camelot extraction with temp file...")
                with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as tmp_file:
                    tmp_file.write(file_content)
                    tmp_file_path = tmp_file.name
                
                try:
                    # Try lattice first (for tables with lines)
                    tables_lattice = camelot.read_pdf(
                        tmp_file_path, 
                        pages='all', 
                        flavor='lattice',
                        line_scale=40
                    )
                    print(f"Camelot lattice found {len(tables_lattice)} tables")
                    
                    # Try stream for tables without lines
                    tables_stream = camelot.read_pdf(
                        tmp_file_path,
                        pages='all',
                        flavor='stream',
                        edge_tol=500
                    )
                    print(f"Camelot stream found {len(tables_stream)} tables")
                    
                    # Combine unique tables
                    all_camelot_tables = tables_lattice + tables_stream
                    camelot_tables_data = self._process_camelot_tables(all_camelot_tables)
                    all_tables.extend(camelot_tables_data)
                    methods_used.append("camelot")
                    
                finally:
                    # Clean up temp file
                    os.unlink(tmp_file_path)
                    
            except Exception as e:
                print(f"Camelot extraction failed: {e}")
            
            # Method 2: PDFPlumber as fallback (fixed parameters)
            try:
                if len(all_tables) == 0:
                    print("Trying PDFPlumber extraction...")
                    plumber_tables = self._extract_with_pdfplumber(file_content)
                    if plumber_tables:
                        all_tables.extend(plumber_tables)
                        methods_used.append("pdfplumber")
                        print(f"PDFPlumber found {len(plumber_tables)} tables")
            except Exception as e:
                print(f"PDFPlumber extraction failed: {e}")
            
            # Method 3: Simple text-based extraction as last resort
            try:
                if len(all_tables) == 0:
                    print("Trying text-based extraction...")
                    text_tables = self._extract_tables_from_text(file_content)
                    if text_tables:
                        all_tables.extend(text_tables)
                        methods_used.append("text_based")
                        print(f"Text-based extraction found {len(text_tables)} tables")
            except Exception as e:
                print(f"Text-based extraction failed: {e}")
            
            # Remove duplicates
            unique_tables = self._remove_duplicate_tables(all_tables)
            
            # Classify table types
            classified_tables = self._classify_tables(unique_tables)
            
            print(f"Total unique tables found: {len(unique_tables)} using methods: {methods_used}")
            
            return {
                "total_tables": len(unique_tables),
                "tables": unique_tables,
                "tables_by_type": classified_tables,
                "extraction_methods": methods_used,
                "extraction_success": len(unique_tables) > 0
            }
            
        except Exception as e:
            print(f"Error in enhanced table extraction: {e}")
            import traceback
            traceback.print_exc()
            return {
                "total_tables": 0,
                "tables": [],
                "tables_by_type": {},
                "extraction_methods": [],
                "extraction_success": False,
                "error": str(e)
            }

    # def extract_tables_from_pdf(self, file_content: bytes) -> Dict[str, Any]:
    #     """Enhanced table extraction with multiple methods"""
    #     try:
    #         print("Attempting enhanced table extraction...")
            
    #         all_tables = []
    #         methods_used = []
            
    #         # Method 1: Camelot with both lattice and stream
    #         try:
    #             print("Trying Camelot extraction...")
    #             # Try lattice first (for tables with lines)
    #             tables_lattice = camelot.read_pdf(
    #                 file_content, 
    #                 pages='all', 
    #                 flavor='lattice',
    #                 line_scale=40,
    #                 copy_text=['h', 'v']
    #             )
    #             print(f"Camelot lattice found {len(tables_lattice)} tables")
                
    #             # Try stream for tables without lines
    #             tables_stream = camelot.read_pdf(
    #                 file_content,
    #                 pages='all',
    #                 flavor='stream',
    #                 edge_tol=500,
    #                 row_tol=10
    #             )
    #             print(f"Camelot stream found {len(tables_stream)} tables")
                
    #             # Combine unique tables
    #             all_camelot_tables = tables_lattice + tables_stream
    #             camelot_tables_data = self._process_camelot_tables(all_camelot_tables)
    #             all_tables.extend(camelot_tables_data)
    #             methods_used.append("camelot")
                
    #         except Exception as e:
    #             print(f"Camelot extraction failed: {e}")
            
    #         # Method 2: PDFPlumber as fallback
    #         try:
    #             if len(all_tables) == 0:
    #                 print("Trying PDFPlumber extraction...")
    #                 plumber_tables = self._extract_with_pdfplumber(file_content)
    #                 if plumber_tables:
    #                     all_tables.extend(plumber_tables)
    #                     methods_used.append("pdfplumber")
    #                     print(f"PDFPlumber found {len(plumber_tables)} tables")
    #         except Exception as e:
    #             print(f"PDFPlumber extraction failed: {e}")
            
    #         # Method 3: Simple text-based extraction as last resort
    #         try:
    #             if len(all_tables) == 0:
    #                 print("Trying text-based extraction...")
    #                 text_tables = self._extract_tables_from_text(file_content)
    #                 if text_tables:
    #                     all_tables.extend(text_tables)
    #                     methods_used.append("text_based")
    #                     print(f"Text-based extraction found {len(text_tables)} tables")
    #         except Exception as e:
    #             print(f"Text-based extraction failed: {e}")
            
    #         # Remove duplicates
    #         unique_tables = self._remove_duplicate_tables(all_tables)
            
    #         # Classify table types
    #         classified_tables = self._classify_tables(unique_tables)
            
    #         print(f"Total unique tables found: {len(unique_tables)} using methods: {methods_used}")
            
    #         return {
    #             "total_tables": len(unique_tables),
    #             "tables": unique_tables,
    #             "tables_by_type": classified_tables,
    #             "extraction_methods": methods_used,
    #             "extraction_success": len(unique_tables) > 0
    #         }
            
    #     except Exception as e:
    #         print(f"Error in enhanced table extraction: {e}")
    #         traceback.print_exc()
    #         return {
    #             "total_tables": 0,
    #             "tables": [],
    #             "tables_by_type": {},
    #             "extraction_methods": [],
    #             "extraction_success": False,
    #             "error": str(e)
    #         }
    
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

    # def _process_camelot_tables(self, tables) -> List[Dict[str, Any]]:
    #     """Process Camelot tables into structured format"""
    #     processed_tables = []
        
    #     for i, table in enumerate(tables):
    #         try:
    #             df = table.df
                
    #             # Clean the DataFrame
    #             df = df.replace('', np.nan)
    #             df = df.dropna(how='all').dropna(axis=1, how='all')
    #             df = df.reset_index(drop=True)
                
    #             if df.empty:
    #                 continue
                
    #             # Get table metadata
    #             table_data = {
    #                 "id": f"table_{i+1}",
    #                 "page": int(table.page) if hasattr(table, 'page') else 1,
    #                 "accuracy": float(table.accuracy) if hasattr(table, 'accuracy') else 0.0,
    #                 "type": "camelot",
    #                 "rows": len(df),
    #                 "columns": len(df.columns),
    #                 "data": df.to_dict(orient='records'),
    #                 "headers": df.iloc[0].tolist() if len(df) > 0 else [],
    #                 "raw_data": df.to_dict(orient='split')
    #             }
                
    #             processed_tables.append(table_data)
    #             print(f"  - Table {i+1}: {len(df)} rows, {len(df.columns)} cols")
                
    #         except Exception as e:
    #             print(f"Error processing table {i+1}: {e}")
    #             continue
        
    #     return processed_tables


    # def _process_camelot_tables(self, tables) -> List[Dict[str, Any]]:
    #     """Process Camelot tables into structured format"""
    #     processed_tables = []
        
    #     for i, table in enumerate(tables):
    #         try:
    #             df = table.df
                
    #             # Clean the DataFrame
    #             df = df.replace('', np.nan)
    #             df = df.dropna(how='all').dropna(axis=1, how='all')
    #             df = df.reset_index(drop=True)
                
    #             if df.empty:
    #                 continue
                
    #             # Get table metadata
    #             table_data = {
    #                 "id": f"table_{i+1}",
    #                 "page": int(table.page) if hasattr(table, 'page') else 1,
    #                 "accuracy": float(table.accuracy) if hasattr(table, 'accuracy') else 0.0,
    #                 "type": "camelot",
    #                 "rows": len(df),
    #                 "columns": len(df.columns),
    #                 "data": df.to_dict(orient='records'),
    #                 "headers": df.iloc[0].tolist() if len(df) > 0 else [],
    #                 "raw_data": df.to_dict(orient='split')
    #             }
                
    #             processed_tables.append(table_data)
    #             print(f"  - Table {i+1}: {len(df)} rows, {len(df.columns)} cols")
                
    #         except Exception as e:
    #             print(f"Error processing table {i+1}: {e}")
    #             continue
        
    #     return processed_tables
    

    def _extract_with_pdfplumber(self, file_content: bytes) -> List[Dict[str, Any]]:
        """Extract tables using PDFPlumber (fixed for newer versions)"""
        import io
        
        tables = []
        with pdfplumber.open(io.BytesIO(file_content)) as pdf:
            for page_num, page in enumerate(pdf.pages, 1):
                try:
                    # Updated table settings for newer pdfplumber
                    page_tables = page.extract_tables({
                        "vertical_strategy": "lines",
                        "horizontal_strategy": "lines",
                        "snap_tolerance": 3,
                        "join_tolerance": 3,
                        "edge_min_length": 3,
                        "min_words_vertical": 3,
                        "min_words_horizontal": 1,
                        "text_tolerance": 3,
                        "text_x_tolerance": 3,
                        "text_y_tolerance": 3,
                        "intersection_tolerance": 3,
                        "intersection_x_tolerance": 3,
                        "intersection_y_tolerance": 3,
                    })
                    
                    for i, table in enumerate(page_tables):
                        if table and len(table) > 0:
                            # Convert to DataFrame
                            df = pd.DataFrame(table)
                            
                            # Clean the table
                            df = df.replace('', np.nan)
                            df = df.dropna(how='all').dropna(axis=1, how='all')
                            df = df.reset_index(drop=True)
                            
                            if not df.empty:
                                table_data = {
                                    "id": f"pdfplumber_table_{page_num}_{i+1}",
                                    "page": page_num,
                                    "type": "pdfplumber",
                                    "rows": len(df),
                                    "columns": len(df.columns),
                                    "data": df.to_dict(orient='records'),
                                    "headers": df.iloc[0].tolist() if len(df) > 0 else [],
                                    "raw_data": df.to_dict(orient='split')
                                }
                                tables.append(table_data)
                                
                except Exception as e:
                    print(f"Error extracting tables from page {page_num}: {e}")
                    continue
        
        return tables

    # def _extract_with_pdfplumber(self, file_content: bytes) -> List[Dict[str, Any]]:
    #     """Extract tables using PDFPlumber"""
    #     import io
        
    #     tables = []
    #     with pdfplumber.open(io.BytesIO(file_content)) as pdf:
    #         for page_num, page in enumerate(pdf.pages, 1):
    #             try:
    #                 page_tables = page.extract_tables({
    #                     "vertical_strategy": "lines",
    #                     "horizontal_strategy": "lines",
    #                     "explicit_vertical_lines": [],
    #                     "explicit_horizontal_lines": [],
    #                     "snap_tolerance": 3,
    #                     "join_tolerance": 3,
    #                     "edge_min_length": 3,
    #                     "min_words_vertical": 3,
    #                     "min_words_horizontal": 1,
    #                     "keep_blank_chars": False,
    #                     "text_tolerance": 3,
    #                     "text_x_tolerance": 3,
    #                     "text_y_tolerance": 3,
    #                     "intersection_tolerance": 3,
    #                     "intersection_x_tolerance": 3,
    #                     "intersection_y_tolerance": 3,
    #                 })
                    
    #                 for i, table in enumerate(page_tables):
    #                     if table and len(table) > 0:
    #                         # Convert to DataFrame
    #                         df = pd.DataFrame(table)
                            
    #                         # Clean the table
    #                         df = df.replace('', np.nan)
    #                         df = df.dropna(how='all').dropna(axis=1, how='all')
    #                         df = df.reset_index(drop=True)
                            
    #                         if not df.empty:
    #                             table_data = {
    #                                 "id": f"pdfplumber_table_{page_num}_{i+1}",
    #                                 "page": page_num,
    #                                 "type": "pdfplumber",
    #                                 "rows": len(df),
    #                                 "columns": len(df.columns),
    #                                 "data": df.to_dict(orient='records'),
    #                                 "headers": df.iloc[0].tolist() if len(df) > 0 else [],
    #                                 "raw_data": df.to_dict(orient='split')
    #                             }
    #                             tables.append(table_data)
                                
    #             except Exception as e:
    #                 print(f"Error extracting tables from page {page_num}: {e}")
    #                 continue
        
    #     return tables
    
    def _extract_tables_from_text(self, file_content: bytes) -> List[Dict[str, Any]]:
        """Extract table-like structures from text"""
        import io
        import re
        
        tables = []
        
        with pdfplumber.open(io.BytesIO(file_content)) as pdf:
            for page_num, page in enumerate(pdf.pages, 1):
                text = page.extract_text()
                if not text:
                    continue
                
                # Look for table-like patterns in text
                lines = text.split('\n')
                
                # Find sections with consistent spacing (potential tables)
                table_sections = []
                current_section = []
                
                for line in lines:
                    # Check if line looks like table row (multiple values with spacing)
                    if re.search(r'\s{3,}.+\s{3,}', line) or re.search(r'\t+', line):
                        current_section.append(line)
                    elif current_section:
                        if len(current_section) >= 2:  # At least header + one row
                            table_sections.append(current_section)
                        current_section = []
                
                # Process found table sections
                for i, section in enumerate(table_sections):
                    # Parse rows
                    rows = []
                    for row_text in section:
                        # Split by multiple spaces or tabs
                        cells = re.split(r'\s{3,}|\t+', row_text.strip())
                        rows.append(cells)
                    
                    if len(rows) >= 2:
                        # Convert to DataFrame
                        df = pd.DataFrame(rows)
                        
                        table_data = {
                            "id": f"text_table_{page_num}_{i+1}",
                            "page": page_num,
                            "type": "text_based",
                            "rows": len(df),
                            "columns": len(df.columns),
                            "data": df.to_dict(orient='records'),
                            "headers": df.iloc[0].tolist() if len(df) > 0 else [],
                            "raw_data": df.to_dict(orient='split'),
                            "confidence": 0.5
                        }
                        tables.append(table_data)
        
        return tables
    
    def _remove_duplicate_tables(self, tables: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Remove duplicate tables"""
        unique_tables = []
        seen_hashes = set()
        
        for table in tables:
            # Create a hash based on table content
            table_hash = hash(str(table.get('data', '')))
            if table_hash not in seen_hashes:
                seen_hashes.add(table_hash)
                unique_tables.append(table)
        
        return unique_tables
    
    def _classify_tables(self, tables: List[Dict[str, Any]]) -> Dict[str, int]:
        """Classify tables by type"""
        table_types = {}
        
        for table in tables:
            table_type = self._identify_table_type(table)
            table_types[table_type] = table_types.get(table_type, 0) + 1
        
        return table_types
    
    def _identify_table_type(self, table: Dict[str, Any]) -> str:
        """Identify the type of table based on content"""
        data = table.get('data', [])
        headers = table.get('headers', [])
        
        if not data:
            return "unknown"
        
        # Check for common table patterns
        header_text = ' '.join([str(h) for h in headers]).lower()
        first_row = data[0] if data else {}
        
        # Payment-related tables
        payment_keywords = ['payment', 'amount', 'due', 'invoice', 'fee', 'charge', 'price', 'cost']
        if any(keyword in header_text for keyword in payment_keywords):
            return "payment_schedule"
        
        # Deliverable tables
        deliverable_keywords = ['deliverable', 'milestone', 'task', 'activity', 'item', 'description']
        if any(keyword in header_text for keyword in deliverable_keywords):
            return "deliverables"
        
        # Personnel tables
        personnel_keywords = ['name', 'role', 'title', 'personnel', 'team', 'contact']
        if any(keyword in header_text for keyword in personnel_keywords):
            return "personnel"
        
        # Schedule tables
        schedule_keywords = ['schedule', 'timeline', 'date', 'time', 'deadline', 'duration']
        if any(keyword in header_text for keyword in schedule_keywords):
            return "schedule"
        
        # Budget tables
        budget_keywords = ['budget', 'cost', 'estimate', 'expense', 'allocation']
        if any(keyword in header_text for keyword in budget_keywords):
            return "budget"
        
        # Compliance tables
        compliance_keywords = ['requirement', 'compliance', 'standard', 'regulation', 'certification']
        if any(keyword in header_text for keyword in compliance_keywords):
            return "compliance"
        
        return "general"
    
    def extract_structured_table_data(self, tables_data: Dict[str, Any]) -> Dict[str, Any]:
        """Extract structured data from tables"""
        structured_data = {
            "payment_schedule": [],
            "deliverables": [],
            "budget": [],
            "personnel": [],
            "compliance": [],
            "schedules": [],
            "other_tables": []
        }
        
        tables = tables_data.get("tables", [])
        
        for table in tables:
            table_type = self._identify_table_type(table)
            data = table.get("data", [])
            
            if table_type == "payment_schedule":
                structured_data["payment_schedule"].extend(self._extract_payment_data(data))
            elif table_type == "deliverables":
                structured_data["deliverables"].extend(self._extract_deliverable_data(data))
            elif table_type == "budget":
                structured_data["budget"].extend(self._extract_budget_data(data))
            elif table_type == "personnel":
                structured_data["personnel"].extend(self._extract_personnel_data(data))
            elif table_type == "compliance":
                structured_data["compliance"].extend(self._extract_compliance_data(data))
            elif table_type == "schedule":
                structured_data["schedules"].extend(self._extract_schedule_data(data))
            else:
                structured_data["other_tables"].append({
                    "type": table_type,
                    "data": data,
                    "table_info": {
                        "rows": table.get("rows", 0),
                        "columns": table.get("columns", 0),
                        "page": table.get("page", 1)
                    }
                })
        
        return structured_data
    
    def _extract_payment_data(self, data: List[Dict]) -> List[Dict]:
        """Extract payment schedule data"""
        payments = []
        
        for i, row in enumerate(data):
            if i == 0:  # Skip header if first row looks like header
                continue
            
            payment = {
                "id": f"payment_{i}",
                "description": row.get("0", "") or row.get("description", "") or f"Payment {i}",
                "amount": row.get("1", "") or row.get("amount", "") or row.get("value", ""),
                "due_date": row.get("2", "") or row.get("date", "") or row.get("due_date", ""),
                "status": row.get("3", "") or row.get("status", "") or "pending",
                "raw_row": row
            }
            payments.append(payment)
        
        return payments
    
    def _clean_json_data(self, data):
        """Clean JSON data by converting NaN, Infinity, and -Infinity to None"""
        import json
        
        def clean_value(value):
            if isinstance(value, float):
                # Check for NaN, Infinity, -Infinity
                import math
                if math.isnan(value):
                    return None
                elif math.isinf(value):
                    return None
            elif isinstance(value, dict):
                return {k: clean_value(v) for k, v in value.items()}
            elif isinstance(value, list):
                return [clean_value(item) for item in value]
            return value
        
        return clean_value(data)



    def _extract_deliverable_data(self, data: List[Dict]) -> List[Dict]:
        """Extract deliverables data with NaN cleaning"""
        deliverables = []
        
        for i, row in enumerate(data):
            if i == 0:  # Skip header
                continue
            
            # Clean the row to remove NaN values
            cleaned_row = {}
            for key, value in row.items():
                if isinstance(value, float):
                    import math
                    if math.isnan(value):
                        cleaned_row[key] = None
                    elif math.isinf(value):
                        cleaned_row[key] = None
                    else:
                        cleaned_row[key] = value
                else:
                    cleaned_row[key] = value
            
            deliverable = {
                "id": f"deliverable_{i}",
                "item": cleaned_row.get("0", "") or cleaned_row.get("item", "") or cleaned_row.get("description", "") or f"Deliverable {i}",
                "description": cleaned_row.get("1", "") or cleaned_row.get("description", "") or "",
                "due_date": cleaned_row.get("2", "") or cleaned_row.get("date", "") or cleaned_row.get("due_date", ""),
                "status": cleaned_row.get("3", "") or cleaned_row.get("status", "") or "pending",
                "raw_row": cleaned_row  # Use cleaned row
            }
            deliverables.append(deliverable)
        
        return deliverables

    # def _extract_deliverable_data(self, data: List[Dict]) -> List[Dict]:
    #     """Extract deliverables data"""
    #     deliverables = []
        
    #     for i, row in enumerate(data):
    #         if i == 0:  # Skip header
    #             continue
            
    #         deliverable = {
    #             "id": f"deliverable_{i}",
    #             "item": row.get("0", "") or row.get("item", "") or row.get("description", "") or f"Deliverable {i}",
    #             "description": row.get("1", "") or row.get("description", "") or "",
    #             "due_date": row.get("2", "") or row.get("date", "") or row.get("due_date", ""),
    #             "status": row.get("3", "") or row.get("status", "") or "pending",
    #             "raw_row": row
    #         }
    #         deliverables.append(deliverable)
        
    #     return deliverables
    
    def _extract_budget_data(self, data: List[Dict]) -> List[Dict]:
        """Extract budget data"""
        budget_items = []
        
        for i, row in enumerate(data):
            if i == 0:  # Skip header
                continue
            
            budget_item = {
                "id": f"budget_{i}",
                "category": row.get("0", "") or row.get("category", "") or row.get("description", ""),
                "amount": row.get("1", "") or row.get("amount", "") or row.get("budget", ""),
                "notes": row.get("2", "") or row.get("notes", "") or row.get("description", ""),
                "raw_row": row
            }
            budget_items.append(budget_item)
        
        return budget_items
    
    def _extract_personnel_data(self, data: List[Dict]) -> List[Dict]:
        """Extract personnel data"""
        personnel = []
        
        for i, row in enumerate(data):
            if i == 0:  # Skip header
                continue
            
            person = {
                "id": f"person_{i}",
                "name": row.get("0", "") or row.get("name", "") or row.get("personnel", ""),
                "role": row.get("1", "") or row.get("role", "") or row.get("title", ""),
                "contact": row.get("2", "") or row.get("contact", "") or row.get("email", ""),
                "notes": row.get("3", "") or row.get("notes", "") or "",
                "raw_row": row
            }
            personnel.append(person)
        
        return personnel
    
    def _extract_compliance_data(self, data: List[Dict]) -> List[Dict]:
        """Extract compliance data"""
        compliance_items = []
        
        for i, row in enumerate(data):
            if i == 0:  # Skip header
                continue
            
            compliance = {
                "id": f"compliance_{i}",
                "requirement": row.get("0", "") or row.get("requirement", "") or row.get("description", ""),
                "standard": row.get("1", "") or row.get("standard", "") or row.get("type", ""),
                "due_date": row.get("2", "") or row.get("date", "") or row.get("due_date", ""),
                "status": row.get("3", "") or row.get("status", "") or "pending",
                "raw_row": row
            }
            compliance_items.append(compliance)
        
        return compliance_items
    
    def _extract_schedule_data(self, data: List[Dict]) -> List[Dict]:
        """Extract schedule data"""
        schedule_items = []
        
        for i, row in enumerate(data):
            if i == 0:  # Skip header
                continue
            
            schedule = {
                "id": f"schedule_{i}",
                "activity": row.get("0", "") or row.get("activity", "") or row.get("description", ""),
                "start_date": row.get("1", "") or row.get("start", "") or row.get("start_date", ""),
                "end_date": row.get("2", "") or row.get("end", "") or row.get("end_date", ""),
                "duration": row.get("3", "") or row.get("duration", "") or row.get("days", ""),
                "raw_row": row
            }
            schedule_items.append(schedule)
        
        return schedule_items