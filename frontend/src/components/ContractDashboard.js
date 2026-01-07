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
} from '@mui/icons-material';
import { getContractSummary, getContracts, searchContracts } from '../services/api';

const ContractDashboard = () => {
  const [summary, setSummary] = useState(null);
  const [contracts, setContracts] = useState([]);
  const [filteredContracts, setFilteredContracts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedContract, setSelectedContract] = useState(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);

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
        // If search returns results with relevance_text, we need to fetch the actual contracts
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
                        <Tooltip title="View Details">
                          <IconButton 
                            size="small"
                            onClick={() => handleViewContract(contract)}
                          >
                            <Visibility fontSize="small" />
                          </IconButton>
                        </Tooltip>
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
    </Box>
  );
};

export default ContractDashboard;