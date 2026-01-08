import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Tooltip,
  LinearProgress,
} from '@mui/material';
import {
  CompareArrowsOutlined,
  CloseOutlined,
  WarningAmberOutlined,
  CheckCircleOutlined,
  DownloadOutlined,
} from '@mui/icons-material';

const ComparisonPanel = ({ 
  selectedContracts = [], 
  onClear,
  onRemoveContract,
  onCompare,
  comparing = false,
}) => {
  if (selectedContracts.length === 0) return null;

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
    <Card sx={{ 
      mb: 3, 
      border: '1px solid',
      borderColor: 'primary.light',
      bgcolor: 'primary.50',
    }}>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CompareArrowsOutlined color="primary" />
            <Typography variant="subtitle1" fontWeight={600}>
              Contract Comparison
            </Typography>
            <Chip 
              label={`${selectedContracts.length}/2`}
              size="small"
              color="primary"
              variant="outlined"
            />
          </Box>
          
          <Tooltip title="Clear selection">
            <IconButton 
              size="small" 
              onClick={onClear}
              sx={{ 
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 2,
              }}
            >
              <CloseOutlined fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' }, gap: 2, mb: 2 }}>
          {selectedContracts.map((contract) => (
            <Card 
              key={contract.id}
              variant="outlined"
              sx={{ 
                p: 2,
                position: 'relative',
                '&:hover': {
                  borderColor: 'primary.main',
                }
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
              
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2 }}>
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
            </Card>
          ))}
        </Box>

        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
          <Button
            variant="outlined"
            onClick={onClear}
            disabled={comparing}
            startIcon={<CloseOutlined />}
          >
            Clear All
          </Button>
          
          <Button
            variant="contained"
            onClick={onCompare}
            disabled={selectedContracts.length !== 2 || comparing}
            startIcon={<CompareArrowsOutlined />}
          >
            {comparing ? 'Comparing...' : 'Compare Now'}
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
};

const ComparisonDialog = ({
  open,
  onClose,
  comparing,
  comparisonResult,
  selectedForCompare,
}) => {
  const exportComparison = () => {
    if (!comparisonResult) return;
    
    const comparisonText = `
Contract Comparison Report
==========================

Contract 1: ${comparisonResult.contract1.contract_type} (v${comparisonResult.contract1.version})
Contract 2: ${comparisonResult.contract2.contract_type} (v${comparisonResult.contract2.version})

Summary: ${comparisonResult.summary}

Suggested Actions:
${comparisonResult.suggested_actions?.map(action => `• ${action}`).join('\n') || 'None'}

Detailed Changes:
${comparisonResult.comparison?.deltas?.map(delta => 
  `${delta.field_name} (${delta.change_type}): ${delta.old_value || 'N/A'} → ${delta.new_value || 'N/A'}`
).join('\n') || 'No changes detected'}
    `;
    
    const blob = new Blob([comparisonText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `contract-comparison-${comparisonResult.contract1.id}-${comparisonResult.contract2.id}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: { borderRadius: 2 }
      }}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CompareArrowsOutlined />
          <Typography variant="h6">Contract Comparison</Typography>
        </Box>
        {comparisonResult && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Comparing: {comparisonResult.contract1.contract_type} (v{comparisonResult.contract1.version}) 
            vs {comparisonResult.contract2.contract_type} (v{comparisonResult.contract2.version})
          </Typography>
        )}
      </DialogTitle>
      
      <DialogContent>
        {comparing ? (
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <LinearProgress sx={{ mb: 3, borderRadius: 2 }} />
            <Typography variant="body1" color="text.secondary">
              Analyzing contract differences...
            </Typography>
          </Box>
        ) : comparisonResult ? (
          <Box sx={{ mt: 1 }}>
            {/* Summary Card */}
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                  Comparison Summary
                </Typography>
                <Typography variant="body2">
                  {comparisonResult.summary}
                </Typography>
              </CardContent>
            </Card>

            {/* Suggested Actions */}
            {comparisonResult.suggested_actions && comparisonResult.suggested_actions.length > 0 && (
              <Card sx={{ mb: 3 }}>
                <CardContent>
                  <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                    Suggested Actions
                  </Typography>
                  <List dense>
                    {comparisonResult.suggested_actions.map((action, idx) => (
                      <ListItem key={idx}>
                        <ListItemIcon>
                          <WarningAmberOutlined color="warning" fontSize="small" />
                        </ListItemIcon>
                        <ListItemText primary={action} />
                      </ListItem>
                    ))}
                  </List>
                </CardContent>
              </Card>
            )}

            {/* Detailed Changes */}
            <Card>
              <CardContent>
                <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                  Detailed Changes
                </Typography>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Field</TableCell>
                        <TableCell>Type</TableCell>
                        <TableCell>Previous Value</TableCell>
                        <TableCell>New Value</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {comparisonResult.comparison?.deltas?.map((delta, idx) => (
                        <TableRow key={idx} hover>
                          <TableCell>
                            <Typography variant="body2" fontWeight={500}>
                              {delta.field_name.replace(/_/g, ' ')}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={delta.change_type}
                              size="small"
                              color={
                                delta.change_type === 'added' ? 'success' : 
                                delta.change_type === 'removed' ? 'error' : 'warning'
                              }
                              variant="outlined"
                            />
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" color="text.secondary">
                              {delta.old_value ? 
                                (typeof delta.old_value === 'object' ? 
                                  JSON.stringify(delta.old_value).slice(0, 100) : 
                                  String(delta.old_value).slice(0, 100)) : 
                                '—'
                              }
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" color="text.secondary">
                              {delta.new_value ? 
                                (typeof delta.new_value === 'object' ? 
                                  JSON.stringify(delta.new_value).slice(0, 100) : 
                                  String(delta.new_value).slice(0, 100)) : 
                                '—'
                              }
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </Box>
        ) : null}
      </DialogContent>
      
      <DialogActions sx={{ p: 2, borderTop: '1px solid', borderColor: 'divider' }}>
        <Button onClick={onClose}>
          Close
        </Button>
        {comparisonResult && (
          <Button 
            variant="contained" 
            onClick={exportComparison}
            startIcon={<DownloadOutlined />}
          >
            Export Report
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export { ComparisonPanel, ComparisonDialog };