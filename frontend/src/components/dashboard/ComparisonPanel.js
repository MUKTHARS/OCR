import React from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Chip,
  IconButton,
  Tooltip,
  Alert,
  Divider,
} from '@mui/material';
import {
  CompareArrowsOutlined,
  CloseOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  InfoOutlined,
} from '@mui/icons-material';

const ComparisonPanel = ({ 
  selectedContracts = [], 
  onCompare, 
  onClear,
  onRemoveContract,
  maxSelection = 2,
}) => {
  if (selectedContracts.length === 0) {
    return null;
  }

  const getRiskColor = (score) => {
    if (score >= 0.7) return 'error';
    if (score >= 0.3) return 'warning';
    return 'success';
  };

  const getRiskLabel = (score) => {
    if (score >= 0.7) return 'High';
    if (score >= 0.3) return 'Medium';
    return 'Low';
  };

  return (
    <Paper sx={{ 
      p: 2, 
      mb: 3, 
      border: '1px solid', 
      borderColor: 'primary.light', 
      bgcolor: 'primary.50',
    }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CompareArrowsOutlined color="primary" />
          <Typography variant="subtitle1" fontWeight={600}>
            Contract Comparison
          </Typography>
          <Chip 
            label={`${selectedContracts.length}/${maxSelection}`} 
            size="small" 
            color="primary"
            variant="outlined"
          />
        </Box>
        
        <IconButton size="small" onClick={onClear}>
          <CloseOutlined />
        </IconButton>
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' }, gap: 2, mb: 2 }}>
        {selectedContracts.map((contract) => (
          <Paper 
            key={contract.id} 
            sx={{ 
              p: 2, 
              bgcolor: 'white',
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 2,
              position: 'relative',
            }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <Box>
                <Typography variant="body1" fontWeight={600} gutterBottom>
                  {contract.contract_type || 'Unknown'}
                </Typography>
                {contract.parties?.length > 0 && (
                  <Typography variant="caption" color="text.secondary">
                    {contract.parties.slice(0, 2).join(', ')}
                    {contract.parties.length > 2 && '...'}
                  </Typography>
                )}
              </Box>
              
              <Tooltip title="Remove from comparison">
                <IconButton 
                  size="small" 
                  onClick={() => onRemoveContract?.(contract.id)}
                  sx={{ mt: -1, mr: -1 }}
                >
                  <CloseOutlined fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
            
            <Divider sx={{ my: 1.5 }} />
            
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box>
                <Typography variant="caption" color="text.secondary" display="block">
                  Risk Level
                </Typography>
                <Chip 
                  label={getRiskLabel(contract.risk_score)} 
                  size="small" 
                  color={getRiskColor(contract.risk_score)}
                  variant="outlined"
                />
              </Box>
              
              <Box sx={{ textAlign: 'right' }}>
                <Typography variant="caption" color="text.secondary" display="block">
                  Value
                </Typography>
                <Typography variant="body2" fontWeight={600}>
                  ${contract.total_value ? contract.total_value.toLocaleString() : 'N/A'}
                </Typography>
              </Box>
            </Box>
          </Paper>
        ))}
      </Box>

      {selectedContracts.length === maxSelection ? (
        <Alert 
          severity="success" 
          icon={<CheckCircleOutlined />}
          sx={{ mb: 2 }}
        >
          Ready to compare {maxSelection} contracts. Analyze differences in clauses, terms, and values.
        </Alert>
      ) : (
        <Alert 
          severity="info"
          icon={<InfoOutlined />}
          sx={{ mb: 2 }}
        >
          Select {maxSelection - selectedContracts.length} more contract{maxSelection - selectedContracts.length !== 1 ? 's' : ''} to compare
        </Alert>
      )}

      <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
        <Button
          variant="outlined"
          onClick={onClear}
          startIcon={<CloseOutlined />}
        >
          Clear All
        </Button>
        
        <Button
          variant="contained"
          onClick={onCompare}
          disabled={selectedContracts.length !== maxSelection}
          startIcon={<CompareArrowsOutlined />}
        >
          Compare Now
        </Button>
      </Box>
    </Paper>
  );
};

export default ComparisonPanel;