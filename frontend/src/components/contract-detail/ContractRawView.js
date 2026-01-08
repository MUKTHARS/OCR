import React from 'react';
import {
  Paper,
  Typography,
  Box,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import DynamicContractViewer from './DynamicContractViewer';

const ContractRawView = ({ contract }) => {
  // Sanitize the contract data to ensure no null values in key fields or clauses
  const sanitizedContract = React.useMemo(() => {
    if (!contract) return contract;
    
    // Create a deep copy to avoid mutating the original
    const sanitized = JSON.parse(JSON.stringify(contract));
    
    // Clean up key_fields if they exist - handle both array and object cases
    if (sanitized.key_fields) {
      if (Array.isArray(sanitized.key_fields)) {
        // Filter out null key fields and ensure value property exists
        sanitized.key_fields = sanitized.key_fields
          .filter(field => field !== null && typeof field === 'object')
          .map(field => ({
            ...field,
            value: field?.value || '',
            label: field?.label || field?.key || ''
          }));
      } else if (typeof sanitized.key_fields === 'object') {
        // Convert object to array if key_fields is an object
        sanitized.key_fields = Object.entries(sanitized.key_fields)
          .filter(([_, field]) => field !== null && typeof field === 'object')
          .map(([key, field]) => ({
            ...field,
            key: key,
            value: field?.value || '',
            label: field?.label || key
          }));
      } else {
        // If it's neither array nor object, set to empty array
        sanitized.key_fields = [];
      }
    } else {
      // Ensure key_fields exists as empty array if not present
      sanitized.key_fields = [];
    }
    
    // Clean up clauses if they exist
    if (sanitized.clauses && typeof sanitized.clauses === 'object') {
      // Remove any null clause entries
      Object.keys(sanitized.clauses).forEach(key => {
        if (sanitized.clauses[key] === null) {
          delete sanitized.clauses[key];
        }
      });
    }
    
    return sanitized;
  }, [contract]);

  return (
    <Paper sx={{ p: 3, maxHeight: '70vh', overflow: 'auto' }}>
      <Typography variant="h6" gutterBottom fontWeight={600}>
        Complete Extracted Data
      </Typography>
      <Typography variant="body2" color="text.secondary" paragraph>
        All data extracted from the contract, including unstructured content.
      </Typography>
      
      <Accordion 
        defaultExpanded
        sx={{ 
          border: '1px solid',
          borderColor: 'divider',
          mb: 3,
        }}
      >
        <AccordionSummary 
          expandIcon={<ExpandMoreIcon />}
          sx={{ 
            bgcolor: 'background.default',
            borderBottom: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Typography variant="subtitle1" fontWeight={600}>
            Complete JSON Data
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Box
            sx={{
              bgcolor: '#f8f9fa',
              p: 2,
              borderRadius: 2,
              maxHeight: 400,
              overflow: 'auto',
              fontFamily: "'JetBrains Mono', 'Courier New', monospace",
              fontSize: '0.75rem',
              lineHeight: 1.5,
            }}
          >
            <pre style={{ margin: 0 }}>
              {JSON.stringify(contract, null, 2)}
            </pre>
          </Box>
        </AccordionDetails>
      </Accordion>
      
      {/* Pass the sanitized contract to DynamicContractViewer */}
      <DynamicContractViewer contract={sanitizedContract} />
    </Paper>
  );
};

export default ContractRawView;