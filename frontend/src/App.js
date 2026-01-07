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

function App() {
  const [activeTab, setActiveTab] = useState(0);
  const [selectedContractId, setSelectedContractId] = useState(null);
  const [refreshList, setRefreshList] = useState(false);

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
    if (newValue === 0) {
      setSelectedContractId(null);
    }
  };

  const handleUploadSuccess = () => {
    setRefreshList(!refreshList);
    setActiveTab(1);
  };

  const handleSelectContract = (contract) => {
    setSelectedContractId(contract.id);
    setActiveTab(2);
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
            Contract Intelligence Agent
          </Typography>
        </Toolbar>
      </AppBar>

      <Container maxWidth="xl">
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
          <Tabs value={activeTab} onChange={handleTabChange}>
            <Tab label="Upload" />
            <Tab label="Contract List" />
            <Tab label="Contract Details" disabled={!selectedContractId} />
          </Tabs>
        </Box>

        {activeTab === 0 && (
          <DocumentUpload onUploadSuccess={handleUploadSuccess} />
        )}

        {activeTab === 1 && (
          <ContractList
            key={refreshList}
            onSelectContract={handleSelectContract}
          />
        )}

        {activeTab === 2 && selectedContractId && (
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