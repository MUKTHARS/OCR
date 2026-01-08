import React from 'react';
import {
  Paper,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Box,
  Chip,
  Divider,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { getSeverityColor } from '../contract-detail/ContractUtils';

const ContractClauses = ({ clauses = {} }) => {
  if (Object.keys(clauses).length === 0) {
    return (
      <Paper sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="h6" color="text.secondary" gutterBottom>
          No clauses extracted
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Clauses will appear here after document processing
        </Typography>
      </Paper>
    );
  }

  return (
    <Paper sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h6" fontWeight={600}>
          Extracted Clauses
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {Object.keys(clauses).length} clause{Object.keys(clauses).length !== 1 ? 's' : ''}
        </Typography>
      </Box>
      <Divider sx={{ mb: 3 }} />
      
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {Object.entries(clauses).map(([clauseName, clauseData]) => (
          <Accordion 
            key={clauseName}
            sx={{ 
              border: '1px solid',
              borderColor: 'divider',
            }}
          >
            <AccordionSummary 
              expandIcon={<ExpandMoreIcon />}
              sx={{ 
                minHeight: 64,
                '&.Mui-expanded': { minHeight: 64 },
              }}
            >
              <Box sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                width: '100%',
                pr: 2,
              }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Box>
                    <Typography variant="subtitle1" fontWeight={600}>
                      {clauseName.replace(/_/g, ' ').toUpperCase()}
                    </Typography>
                    {clauseData.category && (
                      <Typography variant="caption" color="text.secondary">
                        {clauseData.category}
                      </Typography>
                    )}
                  </Box>
                </Box>
                
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {clauseData.risk_level && (
                    <Chip
                      label={`Risk: ${clauseData.risk_level}`}
                      size="small"
                      color={getSeverityColor(clauseData.risk_level)}
                      variant="outlined"
                      sx={{ fontWeight: 500 }}
                    />
                  )}
                  {clauseData.confidence && (
                    <Chip
                      label={`${Math.round(clauseData.confidence * 100)}%`}
                      size="small"
                      color={clauseData.confidence >= 0.9 ? 'success' : clauseData.confidence >= 0.7 ? 'warning' : 'error'}
                      variant="outlined"
                      sx={{ fontWeight: 500 }}
                    />
                  )}
                </Box>
              </Box>
            </AccordionSummary>
            <AccordionDetails sx={{ 
              bgcolor: 'background.default',
              borderTop: '1px solid',
              borderColor: 'divider',
            }}>
              <Typography
                variant="body2"
                sx={{
                  whiteSpace: 'pre-wrap',
                  fontFamily: "'JetBrains Mono', 'Courier New', monospace",
                  fontSize: '0.875rem',
                  lineHeight: 1.7,
                  color: 'text.primary',
                }}
              >
                {clauseData.text}
              </Typography>
            </AccordionDetails>
          </Accordion>
        ))}
      </Box>
    </Paper>
  );
};

export default ContractClauses;