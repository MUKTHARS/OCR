import React, { useState, useEffect } from 'react';
import { Box, ThemeProvider, Button, Snackbar, Alert } from '@mui/material';
import ContractFilters from './ContractFilters';
import ContractTable from './ContractTable';
import { ComparisonPanel, ComparisonDialog } from './ContractComparison';
import contractListTheme from './ContractListTheme';
import { getContracts, searchContracts, compareContracts, debugContracts } from '../../services/api'; // Add debugContracts

const ContractList = ({ onSelectContract }) => {
  const [contracts, setContracts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedForCompare, setSelectedForCompare] = useState([]);
  const [comparisonDialogOpen, setComparisonDialogOpen] = useState(false);
  const [comparisonResult, setComparisonResult] = useState(null);
  const [comparing, setComparing] = useState(false);
  const [filters, setFilters] = useState({});
  const [debugOpen, setDebugOpen] = useState(false); // Add debug state

  useEffect(() => {
    fetchContracts();
  }, []);

  const fetchContracts = async () => {
    setLoading(true);
    try {
      const data = await getContracts();
      console.log('Fetched contracts:', data);
      console.log('Number of contracts:', data.length);
      
      // Debug: Check the structure of returned contracts
      if (data && data.length > 0) {
        console.log('Sample contract structure:', {
          id: data[0].id,
          type: data[0].contract_type,
          parties: data[0].parties,
          signatories: data[0].signatories,
          hasTotalValue: data[0].total_value !== undefined,
          hasRiskScore: data[0].risk_score !== undefined,
          keys: Object.keys(data[0])
        });
      }
      
      setContracts(data || []);
    } catch (error) {
      console.error('Error fetching contracts:', error);
      setContracts([]);
    } finally {
      setLoading(false);
    }
  };

  // Add debug function
  const handleDebug = async () => {
    try {
      const data = await debugContracts();
      setDebugOpen(true);
    } catch (error) {
      console.error('Debug failed:', error);
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
    // Implement filter logic here
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
        {/* Add debug button for testing */}
        <Box sx={{ mb: 2, display: 'flex', justifyContent: 'flex-end' }}>
          <Button 
            variant="outlined" 
            size="small"
            onClick={handleDebug}
            sx={{ fontSize: '0.75rem' }}
          >
            Debug API
          </Button>
        </Box>

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