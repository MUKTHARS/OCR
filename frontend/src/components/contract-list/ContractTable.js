import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Typography,
  Box,
  LinearProgress,
} from '@mui/material';
import {
  ContractTypeCell,
  PartiesCell,
  ValueCell,
  SignatoriesCell,
  DateCell,
  RiskCell,
  ConfidenceCell,
  StatusCell,
  ActionButtons,
} from './ContractActions';

const ContractTable = ({
  contracts,
  loading,
  selectedForCompare,
  onViewContract,
  onCompareSelect,
}) => {
  if (loading) {
    return (
      <Paper sx={{ p: 4, textAlign: 'center' }}>
        <LinearProgress sx={{ mb: 2 }} />
        <Typography variant="body2" color="text.secondary">
          Loading contracts...
        </Typography>
      </Paper>
    );
  }

  // Add this check to see what's wrong with the data
  console.log('ContractTable received:', {
    count: contracts.length,
    firstContract: contracts[0],
    allContracts: contracts.map(c => ({
      id: c.id,
      type: c.contract_type,
      hasParties: c.parties !== undefined,
      hasTotalValue: c.total_value !== undefined,
      hasRiskScore: c.risk_score !== undefined
    }))
  });

  if (contracts.length === 0) {
    return (
      <Paper sx={{ p: 6, textAlign: 'center' }}>
        <Typography variant="h6" color="text.secondary" gutterBottom>
          No contracts found
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Try adjusting your search or filter criteria
        </Typography>
      </Paper>
    );
  }

  return (
    <TableContainer 
      component={Paper}
      sx={{ 
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'divider',
        overflow: 'hidden',
      }}
    >
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Contract Type</TableCell>
            <TableCell>Parties</TableCell>
            <TableCell>Value</TableCell>
            <TableCell>Signatories</TableCell>
            <TableCell>Effective Date</TableCell>
            <TableCell>Risk Level</TableCell>
            <TableCell>Confidence</TableCell>
            <TableCell>Status</TableCell>
            <TableCell align="right">Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {contracts.map((contract) => {
            // Log each contract to debug
            console.log('Rendering contract:', {
              id: contract.id,
              contract_type: contract.contract_type,
              parties: contract.parties,
              total_value: contract.total_value,
              risk_score: contract.risk_score
            });
            
            return (
              <TableRow 
                key={contract.id} 
                hover
                sx={{ 
                  cursor: 'pointer',
                  '&:hover': {
                    backgroundColor: 'action.hover',
                  }
                }}
                onClick={() => onViewContract?.(contract)}
              >
                <TableCell>
                  <ContractTypeCell contract={contract} />
                </TableCell>
                <TableCell>
                  <PartiesCell parties={contract.parties || []} />
                </TableCell>
                <TableCell>
                  <ValueCell 
                    value={contract.total_value} 
                    currency={contract.currency} 
                  />
                </TableCell>
                <TableCell>
                  <SignatoriesCell signatories={contract.signatories || []} />
                </TableCell>
                <TableCell>
                  <DateCell date={contract.effective_date} />
                </TableCell>
                <TableCell>
                  <RiskCell score={contract.risk_score || 0} />
                </TableCell>
                <TableCell>
                  <ConfidenceCell score={contract.confidence_score || 0} />
                </TableCell>
                <TableCell>
                  <StatusCell needsReview={contract.needs_review || false} />
                </TableCell>
                <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                  <ActionButtons
                    contract={contract}
                    onView={onViewContract}
                    onCompare={onCompareSelect}
                    isSelectedForCompare={selectedForCompare.some(c => c.id === contract.id)}
                  />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

export default ContractTable;