import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Tooltip,
  Avatar,
  AvatarGroup,
} from '@mui/material';
import {
  VisibilityOutlined,
  CompareOutlined,
  PersonOutlined,
  CalendarTodayOutlined,
  AttachMoneyOutlined,
} from '@mui/icons-material';

const RecentContracts = ({ contracts = [], onViewContract, onCompare }) => {
  const getRiskChip = (score) => {
    if (score >= 0.7) {
      return <Chip label="High" size="small" color="error" variant="outlined" />;
    }
    if (score >= 0.3) {
      return <Chip label="Medium" size="small" color="warning" variant="outlined" />;
    }
    return <Chip label="Low" size="small" color="success" variant="outlined" />;
  };

  const formatDate = (dateString) => {
    if (!dateString) return '—';
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const formatCurrency = (value, currency = 'USD') => {
    if (!value) return '—';
    const formatter = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
    return formatter.format(value);
  };

  if (contracts.length === 0) {
    return (
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Recent Contracts
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
            No contracts available
          </Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h6" fontWeight={600}>
            Recent Contracts
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Last updated: Just now
          </Typography>
        </Box>
        
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Contract</TableCell>
                <TableCell>Parties</TableCell>
                <TableCell>Value</TableCell>
                <TableCell>Risk</TableCell>
                <TableCell>Added</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {contracts.slice(0, 5).map((contract) => (
                <TableRow 
                  key={contract.id} 
                  hover
                  sx={{ 
                    '&:last-child td': { borderBottom: 0 },
                    cursor: 'pointer',
                    '&:hover': {
                      bgcolor: 'action.hover',
                    }
                  }}
                >
                  <TableCell>
                    <Box>
                      <Typography variant="body2" fontWeight={500}>
                        {contract.contract_type || 'Unknown'}
                      </Typography>
                      {contract.contract_subtype && (
                        <Typography variant="caption" color="text.secondary">
                          {contract.contract_subtype}
                        </Typography>
                      )}
                    </Box>
                  </TableCell>
                  <TableCell>
                    {contract.parties?.length > 0 ? (
                      <AvatarGroup max={2}>
                        {contract.parties.slice(0, 2).map((party, idx) => (
                          <Avatar 
                            key={idx} 
                            sx={{ 
                              width: 24, 
                              height: 24,
                              fontSize: '0.75rem',
                              bgcolor: 'primary.100',
                              color: 'primary.main'
                            }}
                          >
                            {party.charAt(0)}
                          </Avatar>
                        ))}
                      </AvatarGroup>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        No parties
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <AttachMoneyOutlined sx={{ fontSize: 14, color: 'success.main' }} />
                      <Typography variant="body2">
                        {formatCurrency(contract.total_value, contract.currency)}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    {getRiskChip(contract.risk_score)}
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <CalendarTodayOutlined sx={{ fontSize: 14, color: 'text.secondary' }} />
                      <Typography variant="body2">
                        {formatDate(contract.extraction_date)}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell align="right">
                    <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end' }}>
                      <Tooltip title="View Details">
                        <IconButton 
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            onViewContract?.(contract);
                          }}
                        >
                          <VisibilityOutlined fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      {/* <Tooltip title="Compare">
                        <IconButton 
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            onCompare?.(contract);
                          }}
                        >
                          <CompareOutlined fontSize="small" />
                        </IconButton>
                      </Tooltip> */}
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          mt: 3, 
          pt: 2, 
          borderTop: '1px solid',
          borderColor: 'divider'
        }}>
          <Typography variant="caption" color="text.secondary">
            Showing {Math.min(5, contracts.length)} of {contracts.length} contracts
          </Typography>
          <Typography 
            variant="caption" 
            color="primary" 
            sx={{ cursor: 'pointer', fontWeight: 500 }}
            onClick={() => {/* Navigate to full list */}}
          >
            View all →
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
};

export default RecentContracts;