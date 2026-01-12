import React, { useState, useEffect } from 'react';
import { Box, ThemeProvider, Button, Snackbar, Alert, Typography } from '@mui/material';
import { RefreshOutlined } from '@mui/icons-material';
import ContractFilters from './ContractFilters';
import ContractTable from './ContractTable';
import { ComparisonPanel, ComparisonDialog } from './ContractComparison';
import contractListTheme from './ContractListTheme';
import { getContracts, searchContracts, compareContracts, debugContracts } from '../../services/api';

const ContractList = ({ onSelectContract }) => {
  const [contracts, setContracts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedForCompare, setSelectedForCompare] = useState([]);
  const [comparisonDialogOpen, setComparisonDialogOpen] = useState(false);
  const [comparisonResult, setComparisonResult] = useState(null);
  const [comparing, setComparing] = useState(false);
  const [filters, setFilters] = useState({});
  const [debugOpen, setDebugOpen] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    fetchContracts();
    
    // Set up auto-refresh every 3 seconds
    const intervalId = setInterval(() => {
      if (autoRefresh) {
        fetchContracts();
      }
    }, 3000);
    
    return () => clearInterval(intervalId);
  }, [autoRefresh]);

  const fetchContracts = async () => {
    try {
      const data = await getContracts();
      console.log('Contracts fetched:', {
        count: data.length,
        ids: data.map(c => c.id),
        timestamp: new Date().toISOString()
      });
      
      // Check for new contracts
      const oldIds = contracts.map(c => c.id);
      const newIds = data.map(c => c.id);
      const newContracts = data.filter(c => !oldIds.includes(c.id));
      
      if (newContracts.length > 0) {
        console.log('New contracts detected:', newContracts.map(c => c.id));
      }
      
      setContracts(data || []);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error fetching contracts:', error);
      setContracts([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (query) => {
    setSearchQuery(query);
    if (!query.trim()) {
      fetchContracts();
      return;
    }

    setLoading(true);
    try {
      const result = await searchContracts(query);
      setContracts(result.results || []);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (newFilters) => {
    setFilters(newFilters);
    console.log('Filters applied:', newFilters);
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

  const handleRemoveFromComparison = (contractId) => {
    setSelectedForCompare(selectedForCompare.filter(c => c.id !== contractId));
  };

  const handleManualRefresh = () => {
    setLoading(true);
    fetchContracts();
  };

  const handleDebug = async () => {
    try {
      const data = await debugContracts();
      setDebugOpen(true);
    } catch (error) {
      console.error('Debug failed:', error);
    }
  };

  const toggleAutoRefresh = () => {
    setAutoRefresh(!autoRefresh);
  };

  const applyFilters = (contracts, filters) => {
    let filtered = [...contracts];
    
    if (filters.risk !== 'all') {
      filtered = filtered.filter(contract => {
        const score = contract.risk_score || 0;
        if (filters.risk === 'high') return score >= 0.7;
        if (filters.risk === 'medium') return score >= 0.3 && score < 0.7;
        if (filters.risk === 'low') return score < 0.3;
        return true;
      });
    }

    if (filters.status !== 'all') {
      filtered = filtered.filter(contract => {
        if (filters.status === 'reviewed') return !contract.needs_review;
        if (filters.status === 'needs-review') return contract.needs_review;
        if (filters.status === 'active') return contract.effective_date && new Date(contract.effective_date) <= new Date();
        if (filters.status === 'expired') return contract.expiration_date && new Date(contract.expiration_date) < new Date();
        return true;
      });
    }

    return filtered;
  };

  const filteredContracts = applyFilters(contracts, filters);

  return (
    <ThemeProvider theme={contractListTheme}>
      <Box sx={{ width: '100%' }}>
        {/* Header with controls */}
        <Box sx={{ 
          mb: 2, 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 2
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Button 
              variant="outlined" 
              size="small"
              onClick={handleManualRefresh}
              disabled={loading}
              startIcon={<RefreshOutlined />}
            >
              {loading ? 'Refreshing...' : 'Refresh'}
            </Button>
            <Button 
              variant={autoRefresh ? "contained" : "outlined"}
              size="small"
              onClick={toggleAutoRefresh}
              sx={{ fontSize: '0.75rem' }}
            >
              Auto-refresh: {autoRefresh ? 'ON' : 'OFF'}
            </Button>
            <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
              Last: {lastUpdated.toLocaleTimeString()}
            </Typography>
          </Box>
          
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button 
              variant="outlined" 
              size="small"
              onClick={handleDebug}
              sx={{ fontSize: '0.75rem' }}
            >
              Debug API
            </Button>
          </Box>
        </Box>

        {/* Status summary */}
        {contracts.length > 0 && (
          <Box sx={{ 
            mb: 2, 
            p: 2, 
            bgcolor: 'primary.50', 
            borderRadius: 2,
            border: '1px solid',
            borderColor: 'primary.100'
          }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="subtitle2" color="primary.main" fontWeight={600}>
                Total Contracts: {contracts.length}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Showing {filteredContracts.length} after filters
              </Typography>
            </Box>
            {contracts.length > 10 && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                Scroll horizontally to see all columns
              </Typography>
            )}
          </Box>
        )}

        <ComparisonPanel
          selectedContracts={selectedForCompare}
          onClear={clearComparison}
          onRemoveContract={handleRemoveFromComparison}
          onCompare={handleCompareContracts}
          comparing={comparing}
        />

        <ContractFilters
          onSearch={handleSearch}
          onFilterChange={handleFilterChange}
          loading={loading}
        />

        <ContractTable
          contracts={filteredContracts}
          loading={loading}
          selectedForCompare={selectedForCompare}
          onViewContract={onSelectContract}
          onCompareSelect={handleCompareSelect}
        />

        <ComparisonDialog
          open={comparisonDialogOpen}
          onClose={clearComparison}
          comparing={comparing}
          comparisonResult={comparisonResult}
          selectedForCompare={selectedForCompare}
        />

        {/* Debug Snackbar */}
        <Snackbar 
          open={debugOpen} 
          autoHideDuration={6000} 
          onClose={() => setDebugOpen(false)}
        >
          <Alert severity="info" onClose={() => setDebugOpen(false)}>
            Check console for debug output
          </Alert>
        </Snackbar>
      </Box>
    </ThemeProvider>
  );
};

export default ContractList;