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
      
      <DynamicContractViewer contract={contract} />
    </Paper>
  );
};

export default ContractRawView;