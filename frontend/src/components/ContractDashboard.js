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
} from '@mui/icons-material';
import { getContractSummary, getContracts } from '../services/api';

const ContractDashboard = () => {
  const [summary, setSummary] = useState(null);
  const [recentContracts, setRecentContracts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [summaryData, contractsData] = await Promise.all([
        getContractSummary(),
        getContracts(0, 10)
      ]);
      setSummary(summaryData);
      setRecentContracts(contractsData);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
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
                ${summary.total_value.toLocaleString()}
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
                {((summary.high_risk / summary.total_contracts) * 100).toFixed(1)}% of portfolio
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

      {/* Contract Type Distribution */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Contract Types
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {Object.entries(summary.by_type).map(([type, count]) => (
                  <Box key={type} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="body2">{type}</Typography>
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
                Contract Status
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

      {/* Recent Contracts */}
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">Recent Contracts</Typography>
            <Button variant="outlined" size="small">
              View All
            </Button>
          </Box>
          <Divider sx={{ mb: 2 }} />
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Contract Type</TableCell>
                  <TableCell>Parties</TableCell>
                  <TableCell>Value</TableCell>
                  <TableCell>Risk Level</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {recentContracts.map((contract) => (
                  <TableRow key={contract.id} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight="medium">
                        {contract.contract_type}
                      </Typography>
                      {contract.contract_subtype && (
                        <Typography variant="caption" color="text.secondary">
                          {contract.contract_subtype}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {contract.parties?.slice(0, 2).join(' / ')}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {contract.total_value ? (
                        <Typography variant="body2" fontWeight="medium">
                          {contract.currency} {contract.total_value.toLocaleString()}
                        </Typography>
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          N/A
                        </Typography>
                      )}
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
                        <IconButton size="small">
                          <Info fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
    </Box>
  );
};

export default ContractDashboard;