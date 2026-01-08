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
import ContractList from './components/ContractList';
import ContractDetail from './components/ContractDetail';
import ContractDashboard from './components/ContractDashboard';
import AmendmentUpload from './components/AmendmentUpload';
import { getContracts } from './services/api';

function App() {
  const [activeTab, setActiveTab] = useState(0);
  const [selectedContractId, setSelectedContractId] = useState(null);
  const [refreshList, setRefreshList] = useState(false);
  const [existingContracts, setExistingContracts] = useState([]);
  const [isProcessingUpload, setIsProcessingUpload] = useState(false);

  // Load existing contracts for amendment selection
  useEffect(() => {
    fetchExistingContracts();
  }, [refreshList]);

  const fetchExistingContracts = async () => {
    try {
      const contracts = await getContracts(0, 50);
      setExistingContracts(contracts);
    } catch (error) {
      console.error('Error fetching contracts:', error);
    }
  };

  const handleTabChange = (event, newValue) => {
      // Prevent switching away from upload tab if processing
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
    // Don't change tabs - stay on upload tab
  };

  const handleUploadSuccess = (result) => {
    console.log('Upload completed successfully:', result);
    setIsProcessingUpload(false);
    setRefreshList(!refreshList);
    // Wait a bit before switching tabs to show completion message
    setTimeout(() => {
      setActiveTab(3); // Go to Contract List tab
    }, 500);
  };

  const handleUploadError = () => {
    setIsProcessingUpload(false);
    // Stay on upload tab to show error
  };

  const handleSelectContract = (contract) => {
    setSelectedContractId(contract.id);
    setActiveTab(4); // Go to Contract Details tab
  };

  const handleReviewUpdate = () => {
    setRefreshList(!refreshList);
  };

  return (
    <>
      <CssBaseline />
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Enterprise Contract Intelligence Platform
          </Typography>
        </Toolbar>
      </AppBar>

      <Container maxWidth="xl">
        {isProcessingUpload && (
          <Alert severity="info" sx={{ mb: 2 }}>
            Please wait while we process your contract. Do not navigate away from this page.
          </Alert>
        )}

        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
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
        </Box>

        {activeTab === 0 && <ContractDashboard />}
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