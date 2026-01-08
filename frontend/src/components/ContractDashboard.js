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
  Avatar,
  AvatarGroup,
  alpha,
  useTheme,
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
  Assessment,
  Shield,
  ReceiptLong,
  CorporateFare,
  Timeline,
  BarChart,
  FilterList,
  MoreVert,
  Download,
  ArrowUpward,
  ArrowDownward,
} from '@mui/icons-material';
import { getContractSummary, getContracts, searchContracts, compareContracts } from '../services/api';

// Import premium fonts (add these to your index.html or CSS)
// Add these in your index.html head:
// <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet">

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
  const [timeFilter, setTimeFilter] = useState('all');
  const [riskFilter, setRiskFilter] = useState('all');

  const theme = useTheme();

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
      setSelectedForCompare(selectedForCompare.filter(c => c.id !== contract.id));
    } else if (selectedForCompare.length < 2) {
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
    if (score >= 0.7) return '#ff4444';
    if (score >= 0.3) return '#ffaa00';
    return '#00c853';
  };

  const getRiskGradient = (score) => {
    if (score >= 0.7) return 'linear-gradient(135deg, #ff4444, #ff6b6b)';
    if (score >= 0.3) return 'linear-gradient(135deg, #ffaa00, #ffcc33)';
    return 'linear-gradient(135deg, #00c853, #64dd17)';
  };

  const getRiskLabel = (score) => {
    if (score >= 0.7) return 'High';
    if (score >= 0.3) return 'Medium';
    return 'Low';
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return 'Invalid Date';
    }
  };

  const formatCurrency = (value, currency) => {
    if (!value && value !== 0) return 'N/A';
    const formattedValue = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
    return `${currency || 'USD'} ${formattedValue}`;
  };

  const getStatusColor = (status) => {
    switch(status) {
      case 'active': return '#00c853';
      case 'expired': return '#ff4444';
      case 'pending': return '#ffaa00';
      default: return '#9e9e9e';
    }
  };

  const StatCard = ({ title, value, change, icon, color, subtitle }) => (
    <Card 
      sx={{ 
        height: '100%',
        borderRadius: 2,
        border: 'none',
        boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
        transition: 'all 0.3s ease',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
        },
        background: `linear-gradient(135deg, ${color}15, ${color}08)`,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          top: -20,
          right: -20,
          width: 100,
          height: 100,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${color}20, transparent 70%)`,
          opacity: 0.6,
        }}
      />
      <CardContent sx={{ p: 3, position: 'relative' }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 2 }}>
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: 2,
              background: `${color}20`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mr: 2,
            }}
          >
            {React.cloneElement(icon, { 
              sx: { color, fontSize: 24 } 
            })}
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography 
              variant="body2" 
              sx={{ 
                color: 'text.secondary',
                fontFamily: "'Inter', sans-serif",
                fontWeight: 500,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                fontSize: '0.75rem',
                mb: 0.5,
              }}
            >
              {title}
            </Typography>
            <Typography 
              variant="h4" 
              sx={{ 
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                fontWeight: 700,
                color: 'text.primary',
              }}
            >
              {value}
            </Typography>
          </Box>
        </Box>
        {subtitle && (
          <Typography 
            variant="caption" 
            sx={{ 
              color: 'text.secondary',
              fontFamily: "'Inter', sans-serif",
              fontWeight: 400,
              display: 'block',
              mt: 1,
            }}
          >
            {subtitle}
          </Typography>
        )}
        {change && (
          <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
            {change > 0 ? (
              <ArrowUpward sx={{ fontSize: 16, color: '#00c853', mr: 0.5 }} />
            ) : (
              <ArrowDownward sx={{ fontSize: 16, color: '#ff4444', mr: 0.5 }} />
            )}
            <Typography 
              variant="caption" 
              sx={{ 
                color: change > 0 ? '#00c853' : '#ff4444',
                fontFamily: "'Inter', sans-serif",
                fontWeight: 600,
              }}
            >
              {Math.abs(change)}% from last month
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );

  const ContractCard = ({ contract }) => (
    <Paper
      sx={{
        p: 2.5,
        borderRadius: 2,
        border: '1px solid',
        borderColor: alpha(theme.palette.divider, 0.1),
        transition: 'all 0.3s ease',
        cursor: 'pointer',
        '&:hover': {
          borderColor: theme.palette.primary.main,
          boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
          transform: 'translateY(-2px)',
        },
        background: 'white',
      }}
      onClick={() => handleViewContract(contract)}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
        <Box>
          <Typography 
            variant="subtitle1" 
            sx={{ 
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              fontWeight: 600,
              color: 'text.primary',
              mb: 0.5,
            }}
          >
            {contract.contract_type || 'Unknown'}
          </Typography>
          {contract.contract_subtype && (
            <Chip
              label={contract.contract_subtype}
              size="small"
              sx={{
                height: 20,
                fontSize: '0.7rem',
                fontFamily: "'Inter', sans-serif",
                background: alpha(theme.palette.primary.main, 0.1),
                color: theme.palette.primary.main,
              }}
            />
          )}
        </Box>
        <Chip
          label={getRiskLabel(contract.risk_score)}
          size="small"
          sx={{
            background: getRiskGradient(contract.risk_score),
            color: 'white',
            fontWeight: 600,
            fontFamily: "'Inter', sans-serif",
            height: 24,
          }}
        />
      </Box>

      <Typography 
        variant="body2" 
        sx={{ 
          color: 'text.secondary',
          fontFamily: "'Inter', sans-serif",
          fontWeight: 400,
          mb: 2,
          lineHeight: 1.5,
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
      >
        {contract.parties?.join(' • ') || 'No parties specified'}
      </Typography>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box>
          <Typography 
            variant="caption" 
            sx={{ 
              color: 'text.secondary',
              fontFamily: "'Inter', sans-serif",
              fontWeight: 500,
              display: 'block',
            }}
          >
            Value
          </Typography>
          <Typography 
            variant="body2" 
            sx={{ 
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              fontWeight: 600,
              color: 'text.primary',
            }}
          >
            {formatCurrency(contract.total_value, contract.currency)}
          </Typography>
        </Box>
        <Box>
          <Typography 
            variant="caption" 
            sx={{ 
              color: 'text.secondary',
              fontFamily: "'Inter', sans-serif",
              fontWeight: 500,
              display: 'block',
            }}
          >
            Expires
          </Typography>
          <Typography 
            variant="body2" 
            sx={{ 
              fontFamily: "'Inter', sans-serif",
              fontWeight: 400,
              color: 'text.primary',
            }}
          >
            {formatDate(contract.expiration_date)}
          </Typography>
        </Box>
      </Box>

      <Divider sx={{ my: 1.5 }} />

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <AvatarGroup max={3} sx={{ '& .MuiAvatar-root': { width: 28, height: 28, fontSize: '0.8rem' } }}>
          {contract.parties?.slice(0, 3).map((party, idx) => (
            <Avatar 
              key={idx}
              sx={{ 
                bgcolor: alpha(theme.palette.primary.main, 0.1),
                color: theme.palette.primary.main,
                fontWeight: 500,
              }}
            >
              {party.charAt(0).toUpperCase()}
            </Avatar>
          ))}
        </AvatarGroup>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <IconButton 
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              handleCompareSelect(contract);
            }}
            sx={{ 
              width: 32, 
              height: 32,
              background: selectedForCompare.some(c => c.id === contract.id) 
                ? alpha(theme.palette.primary.main, 0.1) 
                : alpha(theme.palette.action.hover, 0.5),
            }}
          >
            <Compare sx={{ fontSize: 16 }} />
          </IconButton>
          <IconButton 
            size="small"
            sx={{ 
              width: 32, 
              height: 32,
              background: alpha(theme.palette.action.hover, 0.5),
            }}
          >
            <MoreVert sx={{ fontSize: 16 }} />
          </IconButton>
        </Box>
      </Box>
    </Paper>
  );

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <Box sx={{ width: '60%', maxWidth: 400 }}>
          <LinearProgress sx={{ height: 4, borderRadius: 2 }} />
          <Typography 
            variant="body2" 
            sx={{ 
              mt: 2, 
              textAlign: 'center',
              fontFamily: "'Inter', sans-serif",
              color: 'text.secondary',
            }}
          >
            Loading contract intelligence...
          </Typography>
        </Box>
      </Box>
    );
  }

  if (!summary) {
    return (
      <Alert 
        severity="warning"
        sx={{ 
          m: 3, 
          borderRadius: 2,
          fontFamily: "'Inter', sans-serif",
        }}
      >
        No contract data available. Upload your first contract to begin analysis.
      </Alert>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, background: '#f8fafc', minHeight: '100vh' }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
          <Box>
            <Typography 
              variant="h3" 
              sx={{ 
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                fontWeight: 700,
                color: 'text.primary',
                mb: 1,
              }}
            >
              Contract Intelligence
            </Typography>
            <Typography 
              variant="body1" 
              sx={{ 
                fontFamily: "'Inter', sans-serif",
                fontWeight: 400,
                color: 'text.secondary',
                maxWidth: 600,
              }}
            >
              Real-time insights and analytics for your contract portfolio. Monitor risks, track expirations, and optimize performance.
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<Download />}
            sx={{
              fontFamily: "'Inter', sans-serif",
              fontWeight: 600,
              textTransform: 'none',
              borderRadius: 2,
              px: 3,
              py: 1,
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              boxShadow: '0 4px 14px 0 rgba(102, 126, 234, 0.39)',
              '&:hover': {
                boxShadow: '0 6px 20px rgba(102, 126, 234, 0.5)',
              },
            }}
          >
            Export Report
          </Button>
        </Box>
        
        {/* Stats Cards */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="Portfolio Value"
              value={formatCurrency(summary.total_value, 'USD')}
              change={12.5}
              icon={<AttachMoney />}
              color="#667eea"
              subtitle={`Across ${summary.total_contracts} contracts`}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="High Risk"
              value={summary.high_risk}
              change={-3.2}
              icon={<Warning />}
              color="#ff4444"
              subtitle={`${((summary.high_risk / summary.total_contracts) * 100).toFixed(1)}% of portfolio`}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="Expiring Soon"
              value={summary.expiring_soon}
              change={8.7}
              icon={<Schedule />}
              color="#ffaa00"
              subtitle="Within next 90 days"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="Needs Review"
              value={summary.needs_review}
              change={15.3}
              icon={<Gavel />}
              color="#764ba2"
              subtitle="Pending legal review"
            />
          </Grid>
        </Grid>
      </Box>

      {/* Main Content Area */}
      <Grid container spacing={3}>
        {/* Left Column - Contracts List */}
        <Grid item xs={12} lg={8}>
          <Card 
            sx={{ 
              borderRadius: 2,
              border: 'none',
              boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
              background: 'white',
              height: '100%',
            }}
          >
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography 
                  variant="h6" 
                  sx={{ 
                    fontFamily: "'Plus Jakarta Sans', sans-serif",
                    fontWeight: 600,
                  }}
                >
                  Recent Contracts
                  <Typography 
                    component="span" 
                    sx={{ 
                      ml: 1,
                      color: 'text.secondary',
                      fontFamily: "'Inter', sans-serif",
                      fontWeight: 400,
                    }}
                  >
                    ({filteredContracts.length})
                  </Typography>
                </Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button
                    startIcon={<FilterList />}
                    sx={{
                      fontFamily: "'Inter', sans-serif",
                      fontWeight: 500,
                      textTransform: 'none',
                      color: 'text.secondary',
                    }}
                  >
                    Filter
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<BarChart />}
                    sx={{
                      fontFamily: "'Inter', sans-serif",
                      fontWeight: 500,
                      textTransform: 'none',
                      borderRadius: 2,
                    }}
                    onClick={fetchDashboardData}
                  >
                    Refresh
                  </Button>
                </Box>
              </Box>

              {/* Search Bar */}
              <Paper
                component="form"
                sx={{
                  p: '2px 4px',
                  display: 'flex',
                  alignItems: 'center',
                  mb: 3,
                  borderRadius: 2,
                  border: '1px solid',
                  borderColor: alpha(theme.palette.divider, 0.2),
                  background: alpha(theme.palette.background.paper, 0.6),
                  backdropFilter: 'blur(8px)',
                }}
              >
                <Search sx={{ ml: 1, color: 'text.secondary' }} />
                <TextField
                  fullWidth
                  placeholder="Search contracts by type, party, or keywords..."
                  variant="standard"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  InputProps={{
                    disableUnderline: true,
                    sx: {
                      ml: 1,
                      fontFamily: "'Inter', sans-serif",
                    }
                  }}
                />
              </Paper>

              {/* Contracts Grid */}
              {filteredContracts.length === 0 ? (
                <Alert 
                  severity="info" 
                  sx={{ 
                    fontFamily: "'Inter', sans-serif",
                    borderRadius: 2,
                  }}
                >
                  {searchQuery ? 'No contracts match your search criteria.' : 'No contracts available.'}
                </Alert>
              ) : (
                <Grid container spacing={2}>
                  {filteredContracts.slice(0, 6).map((contract) => (
                    <Grid item xs={12} sm={6} md={4} key={contract.id}>
                      <ContractCard contract={contract} />
                    </Grid>
                  ))}
                </Grid>
              )}

              {/* View All Button */}
              {filteredContracts.length > 6 && (
                <Box sx={{ textAlign: 'center', mt: 3 }}>
                  <Button
                    variant="text"
                    sx={{
                      fontFamily: "'Inter', sans-serif",
                      fontWeight: 500,
                      textTransform: 'none',
                      color: 'primary.main',
                    }}
                  >
                    View All Contracts →
                  </Button>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Right Column - Analytics & Actions */}
        <Grid item xs={12} lg={4}>
          {/* Risk Distribution */}
          <Card 
            sx={{ 
              mb: 3,
              borderRadius: 2,
              border: 'none',
              boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
              background: 'white',
            }}
          >
            <CardContent sx={{ p: 3 }}>
              <Typography 
                variant="h6" 
                sx={{ 
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                  fontWeight: 600,
                  mb: 2,
                }}
              >
                Risk Distribution
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {['High', 'Medium', 'Low'].map((level) => {
                  const count = {
                    'High': summary.high_risk,
                    'Medium': summary.medium_risk || Math.floor(summary.total_contracts * 0.3),
                    'Low': summary.total_contracts - summary.high_risk - (summary.medium_risk || Math.floor(summary.total_contracts * 0.3))
                  }[level];
                  
                  const percentage = (count / summary.total_contracts) * 100;
                  const color = {
                    'High': '#ff4444',
                    'Medium': '#ffaa00',
                    'Low': '#00c853'
                  }[level];
                  
                  return (
                    <Box key={level}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                        <Typography 
                          variant="body2" 
                          sx={{ 
                            fontFamily: "'Inter', sans-serif",
                            fontWeight: 500,
                          }}
                        >
                          {level} Risk
                        </Typography>
                        <Typography 
                          variant="body2" 
                          sx={{ 
                            fontFamily: "'Inter', sans-serif",
                            fontWeight: 600,
                          }}
                        >
                          {count} ({percentage.toFixed(1)}%)
                        </Typography>
                      </Box>
                      <Box sx={{ 
                        height: 8, 
                        background: alpha(color, 0.1), 
                        borderRadius: 4,
                        overflow: 'hidden',
                      }}>
                        <Box 
                          sx={{ 
                            width: `${percentage}%`, 
                            height: '100%', 
                            background: `linear-gradient(90deg, ${color}, ${alpha(color, 0.8)})`,
                            borderRadius: 4,
                          }} 
                        />
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card 
            sx={{ 
              borderRadius: 2,
              border: 'none',
              boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
              background: 'white',
            }}
          >
            <CardContent sx={{ p: 3 }}>
              <Typography 
                variant="h6" 
                sx={{ 
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                  fontWeight: 600,
                  mb: 2,
                }}
              >
                Quick Actions
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                <Button
                  fullWidth
                  variant="contained"
                  startIcon={<CompareArrows />}
                  sx={{
                    justifyContent: 'flex-start',
                    fontFamily: "'Inter', sans-serif",
                    fontWeight: 500,
                    textTransform: 'none',
                    py: 1.5,
                    borderRadius: 2,
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  }}
                  onClick={handleCompareContracts}
                  disabled={selectedForCompare.length !== 2 || comparing}
                >
                  {comparing ? 'Comparing...' : 'Compare Contracts'}
                </Button>
                <Button
                  fullWidth
                  variant="outlined"
                  startIcon={<Assessment />}
                  sx={{
                    justifyContent: 'flex-start',
                    fontFamily: "'Inter', sans-serif",
                    fontWeight: 500,
                    textTransform: 'none',
                    py: 1.5,
                    borderRadius: 2,
                  }}
                >
                  Generate Risk Report
                </Button>
                <Button
                  fullWidth
                  variant="outlined"
                  startIcon={<Timeline />}
                  sx={{
                    justifyContent: 'flex-start',
                    fontFamily: "'Inter', sans-serif",
                    fontWeight: 500,
                    textTransform: 'none',
                    py: 1.5,
                    borderRadius: 2,
                  }}
                >
                  View Analytics
                </Button>
              </Box>
            </CardContent>
          </Card>

          {/* Comparison Alert */}
          {selectedForCompare.length > 0 && (
            <Alert 
              severity="info"
              sx={{ 
                mt: 3,
                borderRadius: 2,
                fontFamily: "'Inter', sans-serif",
                background: alpha(theme.palette.info.main, 0.1),
                color: theme.palette.info.dark,
              }}
            >
              <Typography variant="body2" fontWeight={500}>
                {selectedForCompare.length} contract(s) selected
              </Typography>
              <Button 
                size="small" 
                onClick={handleCompareContracts}
                disabled={selectedForCompare.length !== 2}
                sx={{ 
                  mt: 1,
                  fontFamily: "'Inter', sans-serif",
                  fontWeight: 500,
                }}
              >
                Compare Now
              </Button>
            </Alert>
          )}
        </Grid>
      </Grid>

      {/* Contract Detail Dialog */}
      <Dialog
        open={detailDialogOpen}
        onClose={() => setDetailDialogOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
            background: '#f8fafc',
          }
        }}
      >
        {selectedContract && (
          <>
            <DialogTitle sx={{ 
              borderBottom: '1px solid',
              borderColor: alpha(theme.palette.divider, 0.1),
              pb: 2,
            }}>
              <Typography 
                variant="h5" 
                sx={{ 
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                  fontWeight: 600,
                }}
              >
                Contract Details
              </Typography>
              <Typography 
                variant="body2" 
                sx={{ 
                  fontFamily: "'Inter', sans-serif",
                  color: 'text.secondary',
                  mt: 0.5,
                }}
              >
                {selectedContract.contract_type || 'Unknown'}
              </Typography>
            </DialogTitle>
            <DialogContent sx={{ mt: 2 }}>
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
        PaperProps={{
          sx: {
            borderRadius: 2,
            background: '#f8fafc',
          }
        }}
      >
        <DialogTitle sx={{ 
          borderBottom: '1px solid',
          borderColor: alpha(theme.palette.divider, 0.1),
          pb: 2,
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CompareArrows />
            <Typography 
              variant="h5" 
              sx={{ 
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                fontWeight: 600,
              }}
            >
              Contract Comparison
            </Typography>
          </Box>
          {comparisonResult && (
            <Typography 
              variant="body2" 
              sx={{ 
                fontFamily: "'Inter', sans-serif",
                color: 'text.secondary',
                mt: 0.5,
              }}
            >
              Comparing: {comparisonResult.contract1.contract_type} vs {comparisonResult.contract2.contract_type}
            </Typography>
          )}
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
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