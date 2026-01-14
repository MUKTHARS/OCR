"""
Utility functions for calculating amended contract values
"""
from typing import Dict, Any, Optional

def calculate_amended_value(
    parent_value: Optional[float], 
    amendment_value: Optional[float], 
    amendment_type: str
) -> Optional[float]:
    """
    Calculate amended value based on amendment type
    
    Args:
        parent_value: Original value from parent contract
        amendment_value: Value from amendment
        amendment_type: Type of amendment (modification, addendum, etc.)
    
    Returns:
        Updated value or None if no change
    """
    if amendment_value is None:
        return parent_value
    
    if parent_value is None:
        return amendment_value
    
    amendment_type = amendment_type.lower()
    
    if amendment_type in ['modification', 'correction', 'termination']:
        # Direct replacement
        return amendment_value
    
    elif amendment_type == 'addendum':
        # Addition to existing value
        return parent_value + amendment_value
    
    elif amendment_type in ['extension', 'renewal']:
        # Usually keep existing value unless specified otherwise
        # For financial extensions, might be an increase
        return amendment_value if amendment_value != parent_value else parent_value
    
    elif amendment_type == 'partial_termination':
        # Reduce value
        return parent_value - amendment_value if amendment_value < parent_value else 0
    
    return parent_value  # Default: no change

def merge_contract_data(
    parent_data: Dict[str, Any],
    amendment_data: Dict[str, Any],
    amendment_type: str
) -> Dict[str, Any]:
    """
    Merge contract data from parent and amendment
    
    Args:
        parent_data: Data from parent contract
        amendment_data: Data from amendment
        amendment_type: Type of amendment
    
    Returns:
        Merged contract data
    """
    merged = parent_data.copy()
    
    # Handle financial data
    if 'financial' in amendment_data:
        if 'financial' not in merged:
            merged['financial'] = {}
        
        for key, value in amendment_data['financial'].items():
            if value is not None:
                if key == 'total_value':
                    merged['financial'][key] = calculate_amended_value(
                        parent_data.get('financial', {}).get(key),
                        value,
                        amendment_type
                    )
                else:
                    merged['financial'][key] = value
    
    # Handle dates
    if 'dates' in amendment_data:
        if 'dates' not in merged:
            merged['dates'] = {}
        
        for date_key, date_value in amendment_data['dates'].items():
            if date_value:
                if amendment_type in ['extension', 'renewal'] and date_key == 'expiration_date':
                    merged['dates'][date_key] = date_value
                elif amendment_type in ['modification', 'correction']:
                    merged['dates'][date_key] = date_value
    
    # Handle parties
    if amendment_type == 'addendum' and 'parties' in amendment_data:
        parent_parties = set(parent_data.get('parties', []))
        amendment_parties = set(amendment_data.get('parties', []))
        merged['parties'] = list(parent_parties.union(amendment_parties))
    elif 'parties' in amendment_data and amendment_data['parties']:
        merged['parties'] = amendment_data['parties']
    
    # Handle clauses
    if 'clauses' in amendment_data:
        if 'clauses' not in merged:
            merged['clauses'] = {}
        
        if amendment_type == 'addendum':
            # Add new clauses
            merged['clauses'].update(amendment_data['clauses'])
        else:
            # Update existing clauses
            for clause_name, clause_value in amendment_data['clauses'].items():
                merged['clauses'][clause_name] = clause_value
    
    # Track changes
    merged['_amendment_info'] = {
        'type': amendment_type,
        'applied': True,
        'source': 'auto_merge'
    }
    
    return merged