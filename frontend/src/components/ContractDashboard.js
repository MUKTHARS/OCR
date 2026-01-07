import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Paper,
  Typography,
  Card,
  CardContent,
  Chip,
  Button,
  LinearProgress,
  IconButton,
  Tooltip,
  Divider,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  InputAdornment,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  Warning,
  CheckCircle,
  Error,
  Info,
  History,
  CompareArrows,
  MonetizationOn,
  Schedule,
  Gavel,
  Search,
  Visibility,
  Person,
  CalendarToday,
  AttachMoney,
  Compare,
} from '@mui/icons-material';
import { getContractSummary, getContracts, searchContracts, compareContracts } from '../services/api';

const ContractDashboard = () => {
  const [summary, setSummary] = useState(null);
  const [contracts, setContracts] = useState([]);
  const [filteredContracts, setFilteredContracts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedContract, setSelectedContract] = useState(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [compareDialogOpen, setCompareDialogOpen] = useState(false);
  const [selectedForCompare, setSelectedForCompare] = useState([]);
  const [comparisonResult, setComparisonResult] = useState(null);
  const [comparing, setComparing] = useState(false);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredContracts(contracts);
    } else {
      const filtered = contracts.filter(contract => 
        contract.contract_type?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        contract.parties?.some(party => party.toLowerCase().includes(searchQuery.toLowerCase())) ||
        contract.contract_subtype?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        contract.master_agreement_id?.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredContracts(filtered);
    }
  }, [searchQuery, contracts]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [summaryData, contractsData] = await Promise.all([
        getContractSummary(),
        getContracts(0, 100)
      ]);
      setSummary(summaryData);
      setContracts(contractsData);
      setFilteredContracts(contractsData);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      fetchDashboardData();
      return;
    }

    setLoading(true);
    try {
      const result = await searchContracts(searchQuery);
      if (result.results) {
        const contractIds = result.results.map(r => r.contract_id);
        const detailedContracts = await getContracts();
        const filtered = detailedContracts.filter(contract => 
          contractIds.includes(contract.id)
        );
        setFilteredContracts(filtered);
      }
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewContract = (contract) => {
    setSelectedContract(contract);
    setDetailDialogOpen(true);
  };

  const handleCompareSelect = (contract) => {
    if (selectedForCompare.some(c => c.id === contract.id)) {
      // Remove from selection
      setSelectedForCompare(selectedForCompare.filter(c => c.id !== contract.id));
    } else if (selectedForCompare.length < 2) {
      // Add to selection
      setSelectedForCompare([...selectedForCompare, contract]);
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
      setCompareDialogOpen(true);
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
    setCompareDialogOpen(false);
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

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString();
    } catch {
      return 'Invalid Date';
    }
  };

  const formatCurrency = (value, currency) => {
    if (!value && value !== 0) return 'N/A';
    const formattedValue = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
    return `${currency || 'USD'} ${formattedValue}`;
  };

  if (loading) {
    return <LinearProgress />;
  }

  if (!summary) {
    return <Alert severity="warning">No data available</Alert>;
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom>
          Contract Intelligence Dashboard
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Real-time insights and analytics for your contract portfolio
        </Typography>
      </Box>

      {/* KPI Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <MonetizationOn color="primary" sx={{ mr: 1 }} />
                <Typography variant="h6">Total Value</Typography>
              </Box>
              <Typography variant="h4" gutterBottom>
                {formatCurrency(summary.total_value, 'USD')}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Across {summary.total_contracts} contracts
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Warning color="warning" sx={{ mr: 1 }} />
                <Typography variant="h6">High Risk</Typography>
              </Box>
              <Typography variant="h4" gutterBottom color="error">
                {summary.high_risk}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {summary.total_contracts > 0 ? 
                  `${((summary.high_risk / summary.total_contracts) * 100).toFixed(1)}% of portfolio` : 
                  'No contracts'
                }
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Schedule color="info" sx={{ mr: 1 }} />
                <Typography variant="h6">Expiring Soon</Typography>
              </Box>
              <Typography variant="h4" gutterBottom color="warning">
                {summary.expiring_soon}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Within next 90 days
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Gavel color="action" sx={{ mr: 1 }} />
                <Typography variant="h6">Needs Review</Typography>
              </Box>
              <Typography variant="h4" gutterBottom color="warning">
                {summary.needs_review}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Pending legal review
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

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
                startIcon={<Compare />}
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

      {/* Search Bar */}
      <Box sx={{ mb: 3 }}>
        <Paper sx={{ p: 2 }}>
          <TextField
            fullWidth
            variant="outlined"
            placeholder="Search contracts by type, party, or ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search />
                </InputAdornment>
              ),
            }}
          />
        </Paper>
      </Box>

      {/* Contract List Section */}
      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">
              All Contracts ({filteredContracts.length})
            </Typography>
            <Button 
              variant="outlined" 
              size="small"
              onClick={fetchDashboardData}
            >
              Refresh
            </Button>
          </Box>
          <Divider sx={{ mb: 2 }} />
          
          {filteredContracts.length === 0 ? (
            <Alert severity="info">
              {searchQuery ? 'No contracts match your search.' : 'No contracts found.'}
            </Alert>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Contract Type</TableCell>
                    <TableCell>Parties</TableCell>
                    <TableCell>Value</TableCell>
                    <TableCell>Signatories</TableCell>
                    <TableCell>Effective Date</TableCell>
                    <TableCell>Expiration Date</TableCell>
                    <TableCell>Risk Level</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredContracts.map((contract) => (
                    <TableRow key={contract.id} hover>
                      <TableCell>
                        <Typography variant="body2" fontWeight="medium">
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
                        <Typography variant="body2" fontWeight="medium">
                          {formatCurrency(contract.total_value, contract.currency)}
                        </Typography>
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
                      <TableCell>
                        <Typography variant="body2">
                          {formatDate(contract.effective_date)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {formatDate(contract.expiration_date)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={getRiskLabel(contract.risk_score)}
                          color={getRiskColor(contract.risk_score)}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        {contract.needs_review ? (
                          <Chip label="Needs Review" color="warning" size="small" />
                        ) : (
                          <Chip label="Reviewed" color="success" size="small" />
                        )}
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          <Tooltip title="View Details">
                            <IconButton 
                              size="small"
                              onClick={() => handleViewContract(contract)}
                            >
                              <Visibility fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title={
                            selectedForCompare.some(c => c.id === contract.id) 
                              ? "Selected for comparison" 
                              : "Compare with another contract"
                          }>
                            <IconButton 
                              size="small"
                              onClick={() => handleCompareSelect(contract)}
                              color={
                                selectedForCompare.some(c => c.id === contract.id) 
                                  ? "primary" 
                                  : "default"
                              }
                            >
                              <Compare fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      {/* Contract Type Distribution */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Contract Types Distribution
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {Object.entries(summary.by_type).map(([type, count]) => (
                  <Box key={type} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="body2">{type || 'Unknown'}</Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Typography variant="body2" color="text.secondary">
                        {count} contracts
                      </Typography>
                      <Chip
                        label={`${((count / summary.total_contracts) * 100).toFixed(1)}%`}
                        size="small"
                        color="primary"
                        variant="outlined"
                      />
                    </Box>
                  </Box>
                ))}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Contract Status Overview
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Box sx={{ textAlign: 'center', p: 2 }}>
                    <CheckCircle color="success" sx={{ fontSize: 48, mb: 1 }} />
                    <Typography variant="h4">{summary.by_status.active || 0}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Active
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={6}>
                  <Box sx={{ textAlign: 'center', p: 2 }}>
                    <Error color="error" sx={{ fontSize: 48, mb: 1 }} />
                    <Typography variant="h4">{summary.by_status.expired || 0}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Expired
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Contract Detail Dialog */}
      <Dialog
        open={detailDialogOpen}
        onClose={() => setDetailDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        {selectedContract && (
          <>
            <DialogTitle>
              Contract Details
              <Typography variant="body2" color="text.secondary">
                {selectedContract.contract_type || 'Unknown'}
              </Typography>
            </DialogTitle>
            <DialogContent>
              <Grid container spacing={2} sx={{ mt: 1 }}>
                <Grid item xs={12} md={6}>
                  <Paper sx={{ p: 2 }}>
                    <Typography variant="subtitle2" gutterBottom color="text.secondary">
                      Contract Information
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      <Box>
                        <Typography variant="caption" color="text.secondary">Type:</Typography>
                        <Typography variant="body1">{selectedContract.contract_type || 'Unknown'}</Typography>
                      </Box>
                      {selectedContract.contract_subtype && (
                        <Box>
                          <Typography variant="caption" color="text.secondary">Subtype:</Typography>
                          <Typography variant="body1">{selectedContract.contract_subtype}</Typography>
                        </Box>
                      )}
                      {selectedContract.master_agreement_id && (
                        <Box>
                          <Typography variant="caption" color="text.secondary">Agreement ID:</Typography>
                          <Typography variant="body1">{selectedContract.master_agreement_id}</Typography>
                        </Box>
                      )}
                    </Box>
                  </Paper>
                </Grid>

                <Grid item xs={12} md={6}>
                  <Paper sx={{ p: 2 }}>
                    <Typography variant="subtitle2" gutterBottom color="text.secondary">
                      Financial Information
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      <Box>
                        <Typography variant="caption" color="text.secondary">Total Value:</Typography>
                        <Typography variant="body1" fontWeight="medium">
                          {formatCurrency(selectedContract.total_value, selectedContract.currency)}
                        </Typography>
                      </Box>
                      <Box>
                        <Typography variant="caption" color="text.secondary">Currency:</Typography>
                        <Typography variant="body1">{selectedContract.currency || 'USD'}</Typography>
                      </Box>
                      {selectedContract.payment_terms && (
                        <Box>
                          <Typography variant="caption" color="text.secondary">Payment Terms:</Typography>
                          <Typography variant="body1">{selectedContract.payment_terms}</Typography>
                        </Box>
                      )}
                    </Box>
                  </Paper>
                </Grid>

                <Grid item xs={12}>
                  <Paper sx={{ p: 2 }}>
                    <Typography variant="subtitle2" gutterBottom color="text.secondary">
                      Parties Involved
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      {selectedContract.parties?.map((party, idx) => (
                        <Typography key={idx} variant="body1">
                          {party}
                        </Typography>
                      ))}
                    </Box>
                  </Paper>
                </Grid>

                {selectedContract.signatories && selectedContract.signatories.length > 0 && (
                  <Grid item xs={12}>
                    <Paper sx={{ p: 2 }}>
                      <Typography variant="subtitle2" gutterBottom color="text.secondary">
                        Signatories
                      </Typography>
                      <TableContainer>
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell>Name</TableCell>
                              <TableCell>Title</TableCell>
                              <TableCell>Signature Date</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {selectedContract.signatories.map((sig, idx) => (
                              <TableRow key={idx}>
                                <TableCell>{sig.name || 'N/A'}</TableCell>
                                <TableCell>{sig.title || 'N/A'}</TableCell>
                                <TableCell>
                                  {sig.signature_date ? formatDate(sig.signature_date) : 'N/A'}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </Paper>
                  </Grid>
                )}

                <Grid item xs={12} md={6}>
                  <Paper sx={{ p: 2 }}>
                    <Typography variant="subtitle2" gutterBottom color="text.secondary">
                      Dates
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      <Box>
                        <Typography variant="caption" color="text.secondary">Effective:</Typography>
                        <Typography variant="body1">{formatDate(selectedContract.effective_date)}</Typography>
                      </Box>
                      <Box>
                        <Typography variant="caption" color="text.secondary">Expiration:</Typography>
                        <Typography variant="body1">{formatDate(selectedContract.expiration_date)}</Typography>
                      </Box>
                      {selectedContract.execution_date && (
                        <Box>
                          <Typography variant="caption" color="text.secondary">Execution:</Typography>
                          <Typography variant="body1">{formatDate(selectedContract.execution_date)}</Typography>
                        </Box>
                      )}
                    </Box>
                  </Paper>
                </Grid>

                <Grid item xs={12} md={6}>
                  <Paper sx={{ p: 2 }}>
                    <Typography variant="subtitle2" gutterBottom color="text.secondary">
                      Risk & Status
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      <Box>
                        <Typography variant="caption" color="text.secondary">Risk Score:</Typography>
                        <Chip
                          label={getRiskLabel(selectedContract.risk_score)}
                          color={getRiskColor(selectedContract.risk_score)}
                          size="small"
                        />
                      </Box>
                      <Box>
                        <Typography variant="caption" color="text.secondary">Confidence:</Typography>
                        <Chip
                          label={`${Math.round(selectedContract.confidence_score * 100)}%`}
                          color={selectedContract.confidence_score >= 0.9 ? 'success' : selectedContract.confidence_score >= 0.7 ? 'warning' : 'error'}
                          size="small"
                        />
                      </Box>
                      <Box>
                        <Typography variant="caption" color="text.secondary">Review Status:</Typography>
                        {selectedContract.needs_review ? (
                          <Chip label="Needs Review" color="warning" size="small" />
                        ) : (
                          <Chip label="Reviewed" color="success" size="small" />
                        )}
                      </Box>
                    </Box>
                  </Paper>
                </Grid>
              </Grid>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setDetailDialogOpen(false)}>Close</Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* Comparison Dialog */}
      <Dialog
        open={compareDialogOpen}
        onClose={clearComparison}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Compare />
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
                            <Warning color="warning" />
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

export default ContractDashboard;