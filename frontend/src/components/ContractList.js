import React, { useState, useEffect } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Typography,
  Box,
  TextField,
  Button,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  LinearProgress,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import VisibilityIcon from '@mui/icons-material/Visibility';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CompareIcon from '@mui/icons-material/Compare';
import WarningIcon from '@mui/icons-material/Warning';
import { getContracts, searchContracts, compareContracts } from '../services/api';

const ContractList = ({ onSelectContract }) => {
  const [contracts, setContracts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedForCompare, setSelectedForCompare] = useState([]);
  const [comparisonDialogOpen, setComparisonDialogOpen] = useState(false);
  const [comparisonResult, setComparisonResult] = useState(null);
  const [comparing, setComparing] = useState(false);

  useEffect(() => {
    fetchContracts();
  }, []);

  const fetchContracts = async () => {
    setLoading(true);
    try {
      const data = await getContracts();
      setContracts(data);
    } catch (error) {
      console.error('Error fetching contracts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      fetchContracts();
      return;
    }

    setLoading(true);
    try {
      const result = await searchContracts(searchQuery);
      setContracts(result.results || []);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCompareSelect = (contract) => {
    if (selectedForCompare.some(c => c.id === contract.id)) {
      setSelectedForCompare(selectedForCompare.filter(c => c.id !== contract.id));
    } else if (selectedForCompare.length < 2) {
      setSelectedForCompare([...selectedForCompare, contract]);
      
      // Auto-open compare dialog when 2 contracts are selected
      if (selectedForCompare.length === 1) {
        handleCompareContracts();
      }
    }
  };

  const handleCompareContracts = async () => {
    if (selectedForCompare.length !== 2) return;
    
    setComparing(true);
    try {
      const result = await compareContracts(
        selectedForCompare[0].id, 
        selectedForCompare[1].id
      );
      setComparisonResult(result);
      setComparisonDialogOpen(true);
    } catch (error) {
      console.error('Error comparing contracts:', error);
      alert('Failed to compare contracts');
    } finally {
      setComparing(false);
    }
  };

  const clearComparison = () => {
    setSelectedForCompare([]);
    setComparisonResult(null);
    setComparisonDialogOpen(false);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  };

  const getConfidenceColor = (score) => {
    if (score >= 0.9) return 'success';
    if (score >= 0.7) return 'warning';
    return 'error';
  };

  const getRiskColor = (score) => {
    if (score >= 0.7) return 'error';
    if (score >= 0.3) return 'warning';
    return 'success';
  };

  const getRiskLabel = (score) => {
    if (score >= 0.7) return 'High Risk';
    if (score >= 0.3) return 'Medium Risk';
    return 'Low Risk';
  };

  return (
    <Box sx={{ width: '100%' }}>
      {/* Comparison Selection Alert */}
      {selectedForCompare.length > 0 && (
        <Alert 
          severity="info" 
          sx={{ mb: 3 }}
          action={
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button 
                size="small" 
                onClick={handleCompareContracts}
                disabled={selectedForCompare.length !== 2 || comparing}
                startIcon={<CompareIcon />}
              >
                {comparing ? 'Comparing...' : 'Compare Selected'}
              </Button>
              <Button size="small" onClick={() => setSelectedForCompare([])}>
                Clear
              </Button>
            </Box>
          }
        >
          {selectedForCompare.length} contract(s) selected for comparison. 
          {selectedForCompare.length === 1 ? ' Select one more to compare.' : ' Ready to compare.'}
        </Alert>
      )}

      <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
        <TextField
          fullWidth
          variant="outlined"
          placeholder="Search contracts by terms, clauses, or parties..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
        />
        <Button
          variant="contained"
          onClick={handleSearch}
          startIcon={<SearchIcon />}
        >
          Search
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Contract Type</TableCell>
              <TableCell>Parties</TableCell>
              <TableCell>Value</TableCell>
              <TableCell>Signatories</TableCell>
              <TableCell>Effective Date</TableCell>
              <TableCell>Risk Level</TableCell>
              <TableCell>Confidence</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={9} align="center">
                  <LinearProgress />
                </TableCell>
              </TableRow>
            ) : contracts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} align="center">
                  No contracts found
                </TableCell>
              </TableRow>
            ) : (
              contracts.map((contract) => (
                <TableRow key={contract.id} hover>
                  <TableCell>
                    <Typography fontWeight="medium">
                      {contract.contract_type || 'Unknown'}
                    </Typography>
                    {contract.contract_subtype && (
                      <Typography variant="caption" color="text.secondary" display="block">
                        {contract.contract_subtype}
                      </Typography>
                    )}
                    {contract.master_agreement_id && (
                      <Typography variant="caption" color="text.secondary" display="block">
                        ID: {contract.master_agreement_id}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                      {contract.parties?.slice(0, 2).map((party, idx) => (
                        <Typography key={idx} variant="body2">
                          {party}
                        </Typography>
                      ))}
                      {contract.parties?.length > 2 && (
                        <Typography variant="caption" color="text.secondary">
                          +{contract.parties.length - 2} more
                        </Typography>
                      )}
                    </Box>
                  </TableCell>
                  <TableCell>
                    {contract.total_value ? (
                      <Typography variant="body2" fontWeight="medium">
                        {contract.currency || 'USD'} {contract.total_value.toLocaleString()}
                      </Typography>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        N/A
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    {contract.signatories && contract.signatories.length > 0 ? (
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                        {contract.signatories.slice(0, 2).map((sig, idx) => (
                          <Typography key={idx} variant="body2">
                            {sig.name}
                          </Typography>
                        ))}
                        {contract.signatories.length > 2 && (
                          <Typography variant="caption" color="text.secondary">
                            +{contract.signatories.length - 2} more
                          </Typography>
                        )}
                      </Box>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        No signatories
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>{formatDate(contract.effective_date)}</TableCell>
                  <TableCell>
                    <Chip
                      label={getRiskLabel(contract.risk_score)}
                      color={getRiskColor(contract.risk_score)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={`${Math.round(contract.confidence_score * 100)}%`}
                      color={getConfidenceColor(contract.confidence_score)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    {contract.needs_review ? (
                      <Chip label="Needs Review" color="warning" size="small" />
                    ) : (
                      <Chip
                        icon={<CheckCircleIcon />}
                        label="Reviewed"
                        color="success"
                        size="small"
                      />
                    )}
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <IconButton
                        size="small"
                        onClick={() => onSelectContract && onSelectContract(contract)}
                      >
                        <VisibilityIcon />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => handleCompareSelect(contract)}
                        color={selectedForCompare.some(c => c.id === contract.id) ? "primary" : "default"}
                      >
                        <CompareIcon />
                      </IconButton>
                    </Box>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Comparison Dialog */}
      <Dialog
        open={comparisonDialogOpen}
        onClose={clearComparison}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CompareIcon />
            <Typography>Contract Comparison</Typography>
          </Box>
          {comparisonResult && (
            <Typography variant="body2" color="text.secondary">
              Comparing: {comparisonResult.contract1.contract_type} (v{comparisonResult.contract1.version}) 
              vs {comparisonResult.contract2.contract_type} (v{comparisonResult.contract2.version})
            </Typography>
          )}
        </DialogTitle>
        <DialogContent>
          {comparing ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <LinearProgress sx={{ mb: 2 }} />
              <Typography>Analyzing contract differences...</Typography>
            </Box>
          ) : comparisonResult ? (
            <Box sx={{ mt: 2 }}>
              {/* Summary Card */}
              <Card sx={{ mb: 3 }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>Comparison Summary</Typography>
                  <Typography variant="body1">
                    {comparisonResult.summary}
                  </Typography>
                </CardContent>
              </Card>

              {/* Suggested Actions */}
              {comparisonResult.suggested_actions && comparisonResult.suggested_actions.length > 0 && (
                <Card sx={{ mb: 3 }}>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>Suggested Actions</Typography>
                    <List>
                      {comparisonResult.suggested_actions.map((action, idx) => (
                        <ListItem key={idx}>
                          <ListItemIcon>
                            <WarningIcon color="warning" />
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
                  <Typography variant="h6" gutterBottom>Detailed Changes</Typography>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Field</TableCell>
                          <TableCell>Type</TableCell>
                          <TableCell>Old Value</TableCell>
                          <TableCell>New Value</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {comparisonResult.comparison.deltas?.map((delta, idx) => (
                          <TableRow key={idx} hover>
                            <TableCell>
                              <Typography variant="body2">
                                {delta.field_name}
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
        <DialogActions>
          <Button onClick={clearComparison}>Close</Button>
          {comparisonResult && (
            <Button 
              variant="contained" 
              onClick={() => {
                // Export functionality
                const comparisonText = `
                  Contract Comparison Report
                  ==========================
                  
                  Contract 1: ${comparisonResult.contract1.contract_type} (v${comparisonResult.contract1.version})
                  Contract 2: ${comparisonResult.contract2.contract_type} (v${comparisonResult.contract2.version})
                  
                  Summary: ${comparisonResult.summary}
                  
                  Suggested Actions:
                  ${comparisonResult.suggested_actions.map(action => `• ${action}`).join('\n')}
                  
                  Detailed Changes:
                  ${comparisonResult.comparison.deltas?.map(delta => 
                    `${delta.field_name} (${delta.change_type}): ${delta.old_value || 'N/A'} → ${delta.new_value || 'N/A'}`
                  ).join('\n')}
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
              }}
            >
              Export Comparison
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ContractList;