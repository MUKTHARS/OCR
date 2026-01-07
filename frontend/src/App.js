import React, { useState } from 'react';
import {
  Container,
  AppBar,
  Toolbar,
  Typography,
  Box,
  Tabs,
  Tab,
  CssBaseline,
} from '@mui/material';
import DocumentUpload from './components/DocumentUpload';
import ContractList from './components/ContractList';
import ContractDetail from './components/ContractDetail';
import ContractDashboard from './components/ContractDashboard'; // Add this import

function App() {
  const [activeTab, setActiveTab] = useState(0);
  const [selectedContractId, setSelectedContractId] = useState(null);
  const [refreshList, setRefreshList] = useState(false);

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
    if (newValue === 0 || newValue === 1) {
      setSelectedContractId(null);
    }
  };

  const handleUploadSuccess = () => {
    setRefreshList(!refreshList);
    setActiveTab(2); // Changed to Contract List tab
  };

  const handleSelectContract = (contract) => {
    setSelectedContractId(contract.id);
    setActiveTab(3); // Changed to Contract Details tab
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
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
          <Tabs value={activeTab} onChange={handleTabChange}>
            <Tab label="Dashboard" />
            <Tab label="Upload" />
            <Tab label="Contract List" />
            <Tab label="Contract Details" disabled={!selectedContractId} />
          </Tabs>
        </Box>

        {activeTab === 0 && <ContractDashboard />}
        {activeTab === 1 && <DocumentUpload onUploadSuccess={handleUploadSuccess} />}
        {activeTab === 2 && (
          <ContractList
            key={refreshList}
            onSelectContract={handleSelectContract}
          />
        )}
        {activeTab === 3 && selectedContractId && (
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