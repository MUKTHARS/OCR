import React, { useState, useEffect } from 'react';
import {
  Container,
  AppBar,
  Toolbar,
  Typography,
  Box,
  Tabs,
  Tab,
  CssBaseline,
  Alert,
} from '@mui/material';
import EnhancedDocumentUpload from './components/EnhancedDocumentUpload';
import ContractList from './components/contract-list/ContractList'; // Updated import path
// import ContractDetail from './components/ContractDetail';
import ContractDetail from './components/contract-detail/ContractDetail';
import AmendmentUpload from './components/AmendmentUpload';
import { getContracts, getContractSummary, compareContracts } from './services/api';
import DashboardLayout from './components/dashboard/DashboardLayout';

function App() {
  const [activeTab, setActiveTab] = useState(0);
  const [selectedContractId, setSelectedContractId] = useState(null);
  const [refreshList, setRefreshList] = useState(false);
  const [existingContracts, setExistingContracts] = useState([]);
  const [isProcessingUpload, setIsProcessingUpload] = useState(false);
  const [summary, setSummary] = useState(null);
  const [selectedForCompare, setSelectedForCompare] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, [refreshList]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [summaryData, contractsData] = await Promise.all([
        getContractSummary(),
        getContracts(0, 50)
      ]);
      setSummary(summaryData);
      setExistingContracts(contractsData);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (event, newValue) => {
    if (isProcessingUpload && newValue !== 1) {
      alert('Please wait for document processing to complete before switching tabs.');
      return;
    }
    setActiveTab(newValue);
    if (newValue !== 4) {
      setSelectedContractId(null);
    }
  };

  const handleUploadStart = () => {
    setIsProcessingUpload(true);
  };

  const handleUploadSuccess = (result) => {
    console.log('Upload completed successfully:', result);
    setIsProcessingUpload(false);
    setRefreshList(!refreshList);
    setTimeout(() => {
      setActiveTab(3);
    }, 500);
  };

  const handleUploadError = () => {
    setIsProcessingUpload(false);
  };

  const handleSelectContract = (contract) => {
    setSelectedContractId(contract.id);
    setActiveTab(4);
  };

  const handleReviewUpdate = () => {
    setRefreshList(!refreshList);
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
    
    try {
      const result = await compareContracts(
        selectedForCompare[0].id, 
        selectedForCompare[1].id
      );
      console.log('Comparison result:', result);
      // Handle comparison result display
      alert('Comparison complete! Check console for details.');
    } catch (error) {
      console.error('Error comparing contracts:', error);
      alert('Failed to compare contracts');
    }
  };

  const handleClearComparison = () => {
    setSelectedForCompare([]);
  };

  const handleRemoveFromComparison = (contractId) => {
    setSelectedForCompare(selectedForCompare.filter(c => c.id !== contractId));
  };

 return (
    <>
      <CssBaseline />
      <AppBar position="static" elevation={0} sx={{ bgcolor: '#1a237e' }}>
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1, fontWeight: 600 }}>
            Contract Intelligence Platform
          </Typography>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Typography variant="body2" sx={{ opacity: 0.8 }}>
              v2.1.0
            </Typography>
          </Box>
        </Toolbar>
      </AppBar>

      {isProcessingUpload && (
        <Alert severity="info" sx={{ mb: 2, borderRadius: 0 }}>
          Please wait while we process your contract. Do not navigate away from this page.
        </Alert>
      )}

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Container maxWidth="xl">
          <Tabs 
            value={activeTab} 
            onChange={handleTabChange}
            aria-label="contract management tabs"
          >
            <Tab label="Dashboard" disabled={isProcessingUpload} />
            <Tab 
              label={isProcessingUpload ? "Processing Upload..." : "Upload Contract"} 
              disabled={isProcessingUpload && activeTab !== 1}
            />
            <Tab label="Upload Amendment" disabled={isProcessingUpload} />
            <Tab label="Contract List" disabled={isProcessingUpload} />
            <Tab 
              label="Contract Details" 
              disabled={!selectedContractId || isProcessingUpload}
            />
          </Tabs>
        </Container>
      </Box>

      <Container maxWidth="xl">
        {activeTab === 0 && (
          <DashboardLayout
            title="Contract Intelligence Dashboard"
            subtitle="Real-time insights and analytics for your contract portfolio"
            summary={summary}
            contracts={existingContracts}
            loading={loading}
            onRefresh={fetchDashboardData}
            onViewContract={handleSelectContract}
            onCompareContracts={handleCompareContracts}
            selectedForCompare={selectedForCompare}
            onClearComparison={handleClearComparison}
            onRemoveFromComparison={handleRemoveFromComparison}
          />
        )}
        {activeTab === 1 && (
          <EnhancedDocumentUpload 
            onUploadStart={handleUploadStart}
            onUploadSuccess={handleUploadSuccess}
            onUploadError={handleUploadError}
            existingContracts={existingContracts}
          />
        )}
        {activeTab === 2 && (
          <AmendmentUpload 
            onUploadSuccess={handleUploadSuccess}
            existingContracts={existingContracts}
          />
        )}
        {activeTab === 3 && (
          <ContractList
            key={refreshList}
            onSelectContract={handleSelectContract}
          />
        )}
        {activeTab === 4 && selectedContractId && (
          <ContractDetail
            contractId={selectedContractId}
            onReviewUpdate={handleReviewUpdate}
          />
        )}
      </Container>
    </>
  );

}

export default App;