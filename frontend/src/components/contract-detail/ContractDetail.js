import React, { useState, useEffect } from 'react';
import { Box, ThemeProvider, Alert } from '@mui/material';
import ContractDetailTheme from './ContractDetailTheme';
import ContractHeader from './ContractHeader';
import ContractTabs from './ContractTabs';
import ContractOverview from './ContractOverview';
import ContractFinancial from './ContractFinancial';
import ContractLegal from './ContractLegal';
import ContractClauses from './ContractClauses';
import ContractVersions from './ContractVersions';
import ContractRawView from './ContractRawView';
import ContractComparison from './ContractComparison';
import { getContract, reviewContract, getContractVersions, getContractDeltas } from '../../services/api';
import { Typography } from '@mui/material';

const ContractDetail = ({ contractId, onReviewUpdate }) => {
  const [contract, setContract] = useState(null);
  const [versions, setVersions] = useState([]);
  const [deltas, setDeltas] = useState([]);
  const [activeTab, setActiveTab] = useState(0);
  const [comparisonDialog, setComparisonDialog] = useState(false);
  const [selectedVersions, setSelectedVersions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (contractId) {
      fetchContractDetails();
    }
  }, [contractId]);

  const fetchContractDetails = async () => {
    setLoading(true);
    try {
      const [contractData, versionsData] = await Promise.all([
        getContract(contractId),
        getContractVersions(contractId)
      ]);
      setContract(contractData);
      setVersions(versionsData);
      
      if (versionsData.length > 1) {
        const deltasData = await getContractDeltas(contractId);
        setDeltas(deltasData);
      }
    } catch (error) {
      console.error('Error fetching contract details:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleReview = async () => {
    try {
      await reviewContract(contractId, true);
      setContract({ ...contract, needs_review: false });
      if (onReviewUpdate) {
        onReviewUpdate();
      }
    } catch (error) {
      console.error('Error reviewing contract:', error);
    }
  };

  const handleVersionCompare = (version1, version2) => {
    setSelectedVersions([version1, version2]);
    setComparisonDialog(true);
  };

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  const handleViewHistory = () => {
    setActiveTab(4); // Version History tab
  };

  if (loading) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography>Loading contract details...</Typography>
      </Box>
    );
  }

  if (!contract) {
    return (
      <Alert severity="error" sx={{ m: 3 }}>
        Contract not found
      </Alert>
    );
  }

  return (
    <ThemeProvider theme={ContractDetailTheme}>
      <Box sx={{ p: 3 }}>
        <ContractHeader
          contract={contract}
          versions={versions}
          onViewHistory={handleViewHistory}
          onCompareVersions={() => handleVersionCompare(versions[0], versions[versions.length - 1])}
          onMarkReviewed={handleReview}
          loading={loading}
        />

        <ContractTabs
          activeTab={activeTab}
          onChange={handleTabChange}
          disabled={{ versions: versions.length <= 1 }}
        />

        {activeTab === 0 && <ContractOverview contract={contract} />}
        {activeTab === 1 && <ContractFinancial contract={contract} />}
        {activeTab === 2 && <ContractLegal contract={contract} />}
        {activeTab === 3 && <ContractClauses clauses={contract.clauses} />}
        {activeTab === 4 && (
          <ContractVersions
            versions={versions}
            currentVersion={contract.version}
            onCompareVersions={handleVersionCompare}
            loading={loading}
          />
        )}
        {activeTab === 5 && <ContractRawView contract={contract} />}

        <ContractComparison
          open={comparisonDialog}
          onClose={() => setComparisonDialog(false)}
          selectedVersions={selectedVersions}
          deltas={deltas}
        />
      </Box>
    </ThemeProvider>
  );
};

export default ContractDetail;