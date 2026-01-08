import React from 'react';
import {
  Paper,
  Grid,
  Box,
  Typography,
  Chip,
  Button,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  CheckCircleOutlined,
  WarningAmberOutlined,
  HistoryOutlined,
  CompareArrowsOutlined,
} from '@mui/icons-material';
import { getRiskColor, getRiskLabel, formatDate } from './ContractUtils';

const ContractHeader = ({
  contract,
  versions = [],
  onViewHistory,
  onCompareVersions,
  onMarkReviewed,
  loading = false,
}) => {
  if (loading || !contract) {
    return (
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box sx={{ width: '100%' }}>
            <Typography variant="h4">Loading...</Typography>
          </Box>
        </Box>
      </Paper>
    );
  }

  return (
    <Paper sx={{ p: 3, mb: 3 }}>
      <Grid container spacing={2} alignItems="center">
        <Grid item xs={12} md={8}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
            <Typography variant="h4" fontWeight={600}>
              {contract.contract_type}
            </Typography>
            {contract.contract_subtype && (
              <Chip 
                label={contract.contract_subtype}
                size="small"
                variant="outlined"
                sx={{ fontWeight: 500 }}
              />
            )}
            {contract.master_agreement_id && (
              <Chip 
                label={`ID: ${contract.master_agreement_id}`}
                size="small"
                color="info"
                variant="outlined"
              />
            )}
          </Box>
          
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
            <Chip
              label={getRiskLabel(contract.risk_score)}
              color={getRiskColor(contract.risk_score)}
              size="small"
              variant="outlined"
              sx={{ fontWeight: 500, borderWidth: 1.5 }}
            />
            <Chip
              label={`Confidence: ${Math.round(contract.confidence_score * 100)}%`}
              color={contract.confidence_score >= 0.9 ? 'success' : contract.confidence_score >= 0.7 ? 'warning' : 'error'}
              size="small"
              variant="outlined"
              sx={{ fontWeight: 500, borderWidth: 1.5 }}
            />
            <Chip
              label={`Version ${contract.version}`}
              size="small"
              variant="outlined"
              sx={{ fontWeight: 500 }}
            />
            {contract.needs_review ? (
              <Chip
                icon={<WarningAmberOutlined />}
                label="Needs Review"
                color="warning"
                size="small"
                sx={{ fontWeight: 500 }}
              />
            ) : (
              <Chip
                icon={<CheckCircleOutlined />}
                label="Reviewed"
                color="success"
                size="small"
                sx={{ fontWeight: 500 }}
              />
            )}
          </Box>
          
          <Typography variant="body2" color="text.secondary">
            Extracted: {formatDate(contract.extraction_date)}
            {contract.version > 1 && ` • Version ${contract.version}`}
          </Typography>
        </Grid>
        
        <Grid item xs={12} md={4}>
          <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
            {versions.length > 1 && (
              <>
                <Tooltip title="Version History">
                  <IconButton 
                    onClick={onViewHistory}
                    sx={{ 
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 2,
                    }}
                  >
                    <HistoryOutlined />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Compare Versions">
                  <IconButton 
                    onClick={onCompareVersions}
                    sx={{ 
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 2,
                    }}
                  >
                    <CompareArrowsOutlined />
                  </IconButton>
                </Tooltip>
              </>
            )}
            {contract.needs_review && (
              <Button
                variant="contained"
                onClick={onMarkReviewed}
                startIcon={<CheckCircleOutlined />}
                sx={{ 
                  minWidth: 160,
                }}
              >
                Mark as Reviewed
              </Button>
            )}
          </Box>
        </Grid>
      </Grid>
      
      {/* Decorative line */}
      <Box sx={{ 
        height: 1,
        width: '100%',
        background: 'linear-gradient(90deg, #1a237e 0%, #0277bd 100%)',
        borderRadius: 1,
        opacity: 0.1,
        mt: 2,
      }} />
    </Paper>
  );
};

export default ContractHeader;