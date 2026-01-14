import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Chip,
  IconButton,
  Tooltip,
  Alert,
  LinearProgress,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Avatar,
  Badge,
  Button,
} from '@mui/material';
import {
  AssessmentOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  AttachMoneyOutlined,
  CalendarTodayOutlined,
  PendingActionsOutlined,
  AccountBalanceOutlined,
  PaidOutlined,
  ArrowForwardOutlined,
  RefreshOutlined,
} from '@mui/icons-material';
import { getContracts, getContractVersions } from '../../services/api';
import RiskDistribution from './RiskDistribution';
const ContractDistribution = ({ summary, contracts: initialContracts, onViewContract }) => {
  const [contracts, setContracts] = useState(initialContracts || []);
  const [loading, setLoading] = useState(false);
  const [contractDetails, setContractDetails] = useState({});
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!initialContracts || initialContracts.length === 0) {
      fetchContracts();
    } else {
      setContracts(initialContracts);
      const details = {};
      initialContracts.forEach(contract => {
        details[contract.id] = {
          amendmentCount: 0,
          subcontractCount: 0,
          versions: []
        };
      });
      setContractDetails(details);
    }
  }, [initialContracts]);

  useEffect(() => {
    const fetchContractDetails = async () => {
      const details = {};
      for (const contract of contracts) {
        try {
          const versions = await getContractVersions(contract.id);
          details[contract.id] = {
            amendmentCount: versions.length - 1,
            subcontractCount: contract.subcontract_count || 0,
            versions: versions,
            totalValue: contract.total_value || 0,
            currency: contract.currency || 'USD',
            fundingInfo: extractFundingInfo(contract),
          };
        } catch (error) {
          console.error(`Error fetching details for contract ${contract.id}:`, error);
          details[contract.id] = {
            amendmentCount: 0,
            subcontractCount: 0,
            versions: [],
            totalValue: contract.total_value || 0,
            currency: contract.currency || 'USD',
            fundingInfo: extractFundingInfo(contract),
          };
        }
      }
      setContractDetails(details);
    };

    if (contracts.length > 0) {
      fetchContractDetails();
    }
  }, [contracts]);

  const extractFundingInfo = (contract) => {
    let fundingInfo = {
      totalFunding: contract.total_value || 0,
      fundsReceived: 0,
      fundsCommitted: contract.total_value || 0,
      remainingFunds: contract.total_value || 0,
      deadline: contract.expiration_date || null,
      disbursementSchedule: [],
    };

    if (contract.extracted_metadata?.payment_schedule) {
      const schedule = contract.extracted_metadata.payment_schedule;
      if (Array.isArray(schedule)) {
        fundingInfo.disbursementSchedule = schedule;
        
        let received = 0;
        let committed = 0;
        
        schedule.forEach(item => {
          if (item.amount) {
            const amount = typeof item.amount === 'string' 
              ? parseFloat(item.amount.replace(/[^0-9.-]+/g, "")) 
              : item.amount;
            
            committed += amount;
            
            if (item.status === 'paid' || item.status === 'completed') {
              received += amount;
            }
          }
        });
        
        if (committed > 0) {
          fundingInfo.fundsCommitted = committed;
          fundingInfo.fundsReceived = received;
          fundingInfo.remainingFunds = committed - received;
        }
      }
    }

    if (contract.clauses && contract.clauses.payment_terms) {
      const paymentClause = contract.clauses.payment_terms;
      if (paymentClause.text) {
        const receivedMatch = paymentClause.text.match(/\$([0-9,]+(\.[0-9]{2})?)\s+(received|paid)/i);
        if (receivedMatch) {
          const receivedAmount = parseFloat(receivedMatch[1].replace(/,/g, ''));
          fundingInfo.fundsReceived = receivedAmount;
          fundingInfo.remainingFunds = fundingInfo.totalFunding - receivedAmount;
        }
      }
    }

    return fundingInfo;
  };

  const calculateFundingMetrics = () => {
    if (contracts.length === 0) return null;

    let totalFunding = 0;
    let totalReceived = 0;
    let totalCommitted = 0;
    let totalRemaining = 0;
    
    contracts.forEach(contract => {
      const details = contractDetails[contract.id] || {};
      const funding = details.fundingInfo || extractFundingInfo(contract);
      
      totalFunding += funding.totalFunding || 0;
      totalReceived += funding.fundsReceived || 0;
      totalCommitted += funding.fundsCommitted || 0;
      totalRemaining += funding.remainingFunds || 0;
    });

    return {
      totalFunding,
      totalReceived,
      totalCommitted,
      totalRemaining,
      utilizationRate: totalCommitted > 0 ? (totalReceived / totalCommitted) * 100 : 0,
      avgGrantSize: contracts.length > 0 ? totalFunding / contracts.length : 0,
      pendingDisbursements: contracts.filter(c => {
        const details = contractDetails[c.id] || {};
        const funding = details.fundingInfo || extractFundingInfo(c);
        return funding.remainingFunds > 0;
      }).length,
      approachingDeadline: contracts.filter(c => {
        const details = contractDetails[c.id] || {};
        const funding = details.fundingInfo || extractFundingInfo(c);
        const days = getDaysUntilDeadline(funding.deadline);
        return days !== null && days > 0 && days <= 30;
      }).length,
    };
  };

  const fetchContracts = async () => {
    setLoading(true);
    try {
      const data = await getContracts(0, 100); // Get up to 100 contracts
      console.log('Dashboard fetched contracts:', data.length);
      setContracts(data);
      
      const details = {};
      data.forEach(contract => {
        details[contract.id] = {
          amendmentCount: 0,
          subcontractCount: 0,
          versions: [],
          totalValue: contract.total_value || 0,
          currency: contract.currency || 'USD',
          fundingInfo: extractFundingInfo(contract),
        };
      });
      setContractDetails(details);
    } catch (error) {
      console.error('Error fetching contracts:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchContracts();
  };

  const getContractStatus = (contract) => {
    const details = contractDetails[contract.id] || {};
    const funding = details.fundingInfo || extractFundingInfo(contract);
    
    if (funding.deadline) {
      const deadlineDate = new Date(funding.deadline);
      const now = new Date();
      const daysDiff = Math.ceil((deadlineDate - now) / (1000 * 60 * 60 * 24));
      
      if (daysDiff < 0) {
        return { label: 'Deadline Passed', color: 'error' };
      } else if (daysDiff <= 30) {
        return { label: 'Deadline Approaching', color: 'warning' };
      }
    }
    
    if (funding.fundsReceived > 0) {
      if (funding.fundsReceived >= funding.fundsCommitted) {
        return { label: 'Fully Funded', color: 'success' };
      } else if (funding.fundsReceived > 0) {
        return { label: 'Partially Funded', color: 'info' };
      }
    }
    
    return { label: 'Not Funded', color: 'default' };
  };

  const calculateContractMetrics = () => {
    if (contracts.length === 0) return null;

    const totalValue = contracts.reduce((sum, contract) => sum + (contract.total_value || 0), 0);
    const averageValue = totalValue / contracts.length;
    const activeContracts = contracts.filter(c => !c.termination_date).length;
    const expiringSoon = contracts.filter(c => {
      if (!c.expiration_date) return false;
      const expDate = new Date(c.expiration_date);
      const now = new Date();
      const daysDiff = Math.ceil((expDate - now) / (1000 * 60 * 60 * 24));
      return daysDiff > 0 && daysDiff <= 30;
    }).length;

    const byType = {};
    contracts.forEach(contract => {
      const type = contract.contract_type || 'Unknown';
      byType[type] = (byType[type] || 0) + 1;
    });

    const totalAmendments = Object.values(contractDetails).reduce(
      (sum, detail) => sum + (detail.amendmentCount || 0), 0
    );

    const totalSubcontracts = Object.values(contractDetails).reduce(
      (sum, detail) => sum + (detail.subcontractCount || 0), 0
    );

    const fundingMetrics = calculateFundingMetrics();

    return {
      totalValue,
      averageValue,
      activeContracts,
      expiringSoon,
      byType,
      totalAmendments,
      totalSubcontracts,
      totalContracts: contracts.length,
      ...fundingMetrics,
    };
  };

  const getDaysUntilDeadline = (dateString) => {
    if (!dateString) return null;
    try {
      const deadline = new Date(dateString);
      const now = new Date();
      const diffTime = deadline - now;
      return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    } catch (e) {
      return null;
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'No deadline';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric' 
      });
    } catch (e) {
      return 'Invalid date';
    }
  };

  const FundingDistributionCards = () => {
    const fundingMetrics = calculateFundingMetrics();
    
    if (!metrics?.byType || Object.keys(metrics.byType).length === 0) {
      return null;
    }

    return (
      <Box sx={{ mb: 3 }}>
        {/* <Typography variant="subtitle2" fontWeight={600} gutterBottom sx={{ mb: 2 }}>
          Funding Distribution by Grant Type
        </Typography> */}
        <Grid container spacing={2}>
          {Object.entries(metrics.byType).map(([type, count]) => {
            const typeContracts = contracts.filter(c => c.contract_type === type);
            const typeFunding = typeContracts.reduce((sum, contract) => {
              const details = contractDetails[contract.id] || {};
              const funding = details.fundingInfo || extractFundingInfo(contract);
              return sum + (funding.totalFunding || 0);
            }, 0);
            
            const percentage = fundingMetrics?.totalFunding > 0 
              ? (typeFunding / fundingMetrics.totalFunding) * 100 
              : 0;
            
            // return (
            //   <Grid item xs={12} sm={6} md={4} lg={3} key={type}>
            //     <Paper 
            //       variant="outlined" 
            //       sx={{ 
            //         p: 2, 
            //         borderRadius: 3,
            //         borderColor: 'divider',
            //         borderWidth: 2,
            //         height: '100%',
            //         display: 'flex',
            //         flexDirection: 'column',
            //         transition: 'all 0.2s ease',
            //         '&:hover': {
            //           transform: 'translateY(-2px)',
            //           boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            //           borderColor: 'primary.light',
            //         }
            //       }}
            //     >
            //       <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
            //         <Box>
            //           <Typography variant="body2" fontWeight={600} color="primary" gutterBottom>
            //             {type}
            //           </Typography>
            //           <Chip 
            //             label={`${count} grant${count !== 1 ? 's' : ''}`}
            //             size="small"
            //             color="primary"
            //             variant="outlined"
            //           />
            //         </Box>
            //         <Avatar 
            //           sx={{ 
            //             bgcolor: 'primary.50', 
            //             color: 'primary.main',
            //             width: 40,
            //             height: 40,
            //             fontSize: '1rem',
            //             fontWeight: 600
            //           }}
            //         >
            //           {percentage.toFixed(0)}%
            //         </Avatar>
            //       </Box>
                  
            //       <Box sx={{ mt: 'auto' }}>
            //         <Typography variant="h5" fontWeight={700} color="text.primary" gutterBottom>
            //           ${typeFunding.toLocaleString()}
            //         </Typography>
                    
            //         <Box sx={{ mb: 1 }}>
            //           <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
            //             {/* <Typography variant="caption" color="text.secondary">
            //               Allocation
            //             </Typography>
            //             <Typography variant="caption" fontWeight={600}>
            //               {percentage.toFixed(1)}%
            //             </Typography> */}
            //           </Box>
            //           <LinearProgress 
            //             variant="determinate" 
            //             value={percentage}
            //             sx={{ 
            //               height: 6,
            //               borderRadius: 3,
            //               bgcolor: 'grey.200',
            //               '& .MuiLinearProgress-bar': {
            //                 borderRadius: 3,
            //                 background: 'linear-gradient(90deg, #1a237e 0%, #534bae 100%)',
            //               }
            //             }}
            //           />
            //         </Box>
                    
            //         <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2 }}>
            //           <Box>
            //             <Typography variant="caption" color="text.secondary" display="block">
            //               Avg. Grant
            //             </Typography>
            //             <Typography variant="caption" fontWeight={600}>
            //               ${(typeFunding / count).toLocaleString(undefined, { maximumFractionDigits: 0 })}
            //             </Typography>
            //           </Box>
            //           <Box sx={{ textAlign: 'right' }}>
            //             <Typography variant="caption" color="text.secondary" display="block">
            //               New
            //             </Typography>
            //             <Typography variant="caption" fontWeight={600} color="success.main">
            //               {Math.min(count, 3)} this month
            //             </Typography>
            //           </Box>
            //         </Box>
            //       </Box>
            //     </Paper>
            //   </Grid>
            // );
          })}
        </Grid>
      </Box>
    );
  };

  const metrics = calculateContractMetrics();

  if (loading) {
    return (
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
            <AssessmentOutlined sx={{ mr: 1.5, color: 'primary.main' }} />
            <Typography variant="h6" fontWeight={600}>
              Grant Portfolio Dashboard
            </Typography>
          </Box>
          <LinearProgress />
        </CardContent>
      </Card>
    );
  }

  if (contracts.length === 0) {
    return (
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
            <AssessmentOutlined sx={{ mr: 1.5, color: 'primary.main' }} />
            <Typography variant="h6" fontWeight={600}>
              Grant Portfolio Dashboard
            </Typography>
          </Box>
          <Alert severity="info">
            No grants found. Upload grant agreements to start tracking.
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            {/* <AssessmentOutlined sx={{ mr: 1.5, color: 'primary.main' }} /> */}
            {/* <Typography variant="h6" fontWeight={600}>
              Grant Portfolio Dashboard
            </Typography>
            <Chip 
              label={`${contracts.length} Grants`}
              size="small"
              color="primary"
              sx={{ ml: 2 }}
            /> */}
          </Box>
          
          {/* <Button
            variant="outlined"
            size="small"
            onClick={handleRefresh}
            disabled={refreshing}
            startIcon={<RefreshOutlined />}
          >
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </Button> */}
        </Box>

        {/* Debug info */}
        <Box sx={{ 
          mb: 2, 
          p: 1, 
          bgcolor: 'info.50', 
          borderRadius: 1,
          border: '1px solid',
          borderColor: 'info.200'
        }}>
          <Typography variant="caption" color="text.secondary">
            Showing {contracts.length} contracts. Newest: Contract ID {Math.max(...contracts.map(c => c.id))}
          </Typography>
        </Box>

        {/* Funding Distribution Cards */}
        <FundingDistributionCards />

        {/* Grants Table with Funding Information */}
        <Box sx={{ 
          mb: 3,
          position: 'relative',
          borderRadius: '8px', 
          border: '1px solid', 
          borderColor: 'divider',
          overflow: 'auto',
          maxHeight: '500px',
          scrollbarWidth: 'thin',
          '&::-webkit-scrollbar': {
            width: '8px',
            height: '8px',
          },
          '&::-webkit-scrollbar-track': {
            background: '#f1f1f1',
            borderRadius: '4px',
          },
          '&::-webkit-scrollbar-thumb': {
            background: '#888',
            borderRadius: '4px',
            '&:hover': {
              background: '#555',
            }
          }
        }}>
          <TableContainer 
            component={Paper} 
            variant="outlined" 
            sx={{ 
              borderRadius: 2,
              minWidth: '900px',
              width: '100%',
            }}
          >
            <Table 
              size="small" 
              stickyHeader 
              sx={{ 
                width: '100%',
                tableLayout: 'fixed',
              }}
            >
              <colgroup>
                <col style={{ width: '22%' }} />
                <col style={{ width: '14%' }} />
                <col style={{ width: '22%' }} />
                <col style={{ width: '14%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '4%' }} />
              </colgroup>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ width: '22%', padding: '10px 8px' }}>
                    <Typography variant="caption" fontWeight={600} noWrap>
                      Grant / Contract
                    </Typography>
                  </TableCell>
                  <TableCell align="center" sx={{ width: '14%', padding: '10px 8px' }}>
                    <Typography variant="caption" fontWeight={600} noWrap>
                      Total Funding
                    </Typography>
                  </TableCell>
                  <TableCell align="center" sx={{ width: '22%', padding: '10px 8px' }}>
                    <Typography variant="caption" fontWeight={600} noWrap>
                      Received vs Committed
                    </Typography>
                  </TableCell>
                  <TableCell align="center" sx={{ width: '14%', padding: '10px 8px' }}>
                    <Typography variant="caption" fontWeight={600} noWrap>
                      Remaining Funds
                    </Typography>
                  </TableCell>
                  <TableCell align="center" sx={{ width: '12%', padding: '10px 8px' }}>
                    <Typography variant="caption" fontWeight={600} noWrap>
                      Deadline
                    </Typography>
                  </TableCell>
                  <TableCell align="center" sx={{ width: '12%', padding: '10px 8px' }}>
                    <Typography variant="caption" fontWeight={600} noWrap>
                      Status
                    </Typography>
                  </TableCell>
                  <TableCell align="center" sx={{ width: '4%', padding: '10px 8px' }}>
                    <Typography variant="caption" fontWeight={600} noWrap>
                      Actions
                    </Typography>
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {contracts.map((contract) => {
                  const details = contractDetails[contract.id] || {};
                  const funding = details.fundingInfo || extractFundingInfo(contract);
                  const status = getContractStatus(contract);
                  const daysUntilDeadline = getDaysUntilDeadline(funding.deadline);
                  
                  return (
                    <TableRow 
                      key={contract.id}
                      hover
                      onClick={() => onViewContract?.(contract)}
                      sx={{ 
                        '&:last-child td, &:last-child th': { border: 0 },
                        bgcolor: contract.needs_review ? 'warning.50' : 'inherit',
                        cursor: 'pointer', 
                        '&:hover': {
                          bgcolor: 'action.hover',
                        }
                      }}
                    >
                      <TableCell sx={{ width: '22%', padding: '10px 8px' }}>
                        <Box sx={{ overflow: 'hidden' }}>
                          <Typography variant="caption" fontWeight={600} display="block" noWrap>
                            {contract.contract_type || 'Unnamed Grant'}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" display="block" noWrap>
                            {contract.master_agreement_id || `ID: ${contract.id}`}
                            {details.amendmentCount > 0 && (
                              <Badge 
                                badgeContent={`+${details.amendmentCount}`} 
                                color="secondary" 
                                sx={{ ml: 0.5 }}
                                size="small"
                              />
                            )}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell align="center" sx={{ width: '14%', padding: '10px 8px' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                          <AttachMoneyOutlined fontSize="small" color="primary" />
                          <Typography variant="caption" fontWeight={600} noWrap>
                            ${(funding.totalFunding || 0).toLocaleString()}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell align="center" sx={{ width: '22%', padding: '10px 8px' }}>
                        <Box sx={{ minWidth: 0, maxWidth: '100%' }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5, gap: 0.5 }}>
                            <Typography variant="caption" color="success.main" fontWeight={600} noWrap sx={{ fontSize: '0.7rem' }}>
                              ${(funding.fundsReceived || 0).toLocaleString()}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" noWrap sx={{ fontSize: '0.7rem' }}>
                              of
                            </Typography>
                            <Typography variant="caption" fontWeight={600} noWrap sx={{ fontSize: '0.7rem' }}>
                              ${(funding.fundsCommitted || 0).toLocaleString()}
                            </Typography>
                          </Box>
                          <LinearProgress 
                            variant="determinate" 
                            value={funding.fundsCommitted > 0 ? (funding.fundsReceived / funding.fundsCommitted) * 100 : 0}
                            sx={{ 
                              height: 4,
                              borderRadius: 2,
                              bgcolor: 'grey.200',
                              '& .MuiLinearProgress-bar': {
                                bgcolor: funding.fundsReceived >= funding.fundsCommitted ? 'success.main' : 'primary.main'
                              }
                            }}
                          />
                          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block', fontSize: '0.7rem' }} noWrap>
                            {funding.fundsCommitted > 0 ? 
                              `${((funding.fundsReceived / funding.fundsCommitted) * 100).toFixed(1)}%` : 
                              'No commitment'
                            }
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell align="center" sx={{ width: '14%', padding: '10px 8px' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                          <PendingActionsOutlined fontSize="small" color="warning" />
                          <Box sx={{ overflow: 'hidden' }}>
                            <Typography variant="caption" fontWeight={600} display="block" noWrap>
                              ${(funding.remainingFunds || 0).toLocaleString()}
                            </Typography>
                            {daysUntilDeadline !== null && daysUntilDeadline > 0 && (
                              <Typography variant="caption" color="text.secondary" display="block" noWrap sx={{ fontSize: '0.7rem' }}>
                                {daysUntilDeadline}d left
                              </Typography>
                            )}
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell align="center" sx={{ width: '12%', padding: '10px 8px' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                          <CalendarTodayOutlined fontSize="small" color="action" />
                          <Typography variant="caption" noWrap sx={{ fontSize: '0.7rem' }}>
                            {formatDate(funding.deadline)}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell align="center" sx={{ width: '12%', padding: '10px 8px' }}>
                        <Chip 
                          label={status.label}
                          size="small"
                          color={status.color}
                          variant="filled"
                          sx={{ 
                            minWidth: 0,
                            maxWidth: '100%',
                            fontSize: '0.7rem',
                            height: '24px',
                            '& .MuiChip-label': {
                              px: 1,
                              fontSize: '0.7rem',
                            }
                          }}
                        />
                      </TableCell>
                      <TableCell align="center" sx={{ width: '4%', padding: '10px 8px' }}>
                        <Tooltip title="View Details">
                          <IconButton 
                            size="small" 
                            sx={{ padding: '4px' }}
                            onClick={(e) => {
                              e.stopPropagation();
                              console.log('View details for contract:', contract.id);
                              onViewContract?.(contract);
                            }}
                          >
                            <ArrowForwardOutlined fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>

        {/* Funding Summary Footer */}
        <Paper 
          variant="outlined" 
          sx={{ 
            p: 2, 
            borderRadius: 2,
            bgcolor: 'primary.50',
            borderColor: 'primary.100'
          }}
        >
          <Grid container spacing={2}>
            <Grid item xs={6} md={3}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <AccountBalanceOutlined fontSize="small" color="primary" />
                <Box>
                  <Typography variant="caption" color="text.secondary" display="block">
                    Avg. Grant Size
                  </Typography>
                  <Typography variant="body2" fontWeight={600}>
                    ${(metrics?.avgGrantSize || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </Typography>
                </Box>
              </Box>
            </Grid>
            <Grid item xs={6} md={3}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <PaidOutlined fontSize="small" color="success" />
                <Box>
                  <Typography variant="caption" color="text.secondary" display="block">
                    Disbursement Rate
                  </Typography>
                  <Typography variant="body2" fontWeight={600}>
                    {metrics?.utilizationRate?.toFixed(1) || 0}%
                  </Typography>
                </Box>
              </Box>
            </Grid>
            <Grid item xs={6} md={3}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <PendingActionsOutlined fontSize="small" color="warning" />
                <Box>
                  <Typography variant="caption" color="text-secondary" display="block">
                    Pending Disbursements
                  </Typography>
                  <Typography variant="body2" fontWeight={600}>
                    {metrics?.pendingDisbursements || 0}
                  </Typography>
                </Box>
              </Box>
            </Grid>
            <Grid item xs={6} md={3}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <WarningOutlined fontSize="small" color="error" />
                <Box>
                  <Typography variant="caption" color="text-secondary" display="block">
                    Approaching Deadline
                  </Typography>
                  <Typography variant="body2" fontWeight={600}>
                    {metrics?.approachingDeadline || 0}
                  </Typography>
                </Box>
              </Box>
            </Grid>
          </Grid>
        </Paper>
      </CardContent>
    </Card>
  );
};

const ContractMetrics = ({ summary, contracts }) => {
  return (
    <Grid container spacing={3} sx={{ mb: 4 }}>
      <Grid item xs={12} lg={12}>
        <ContractDistribution 
          summary={summary} 
          contracts={contracts} 
          onViewContract={(contract) => {
            console.log('Dashboard contract clicked:', contract.id);
            // You can add navigation here
          }}
        />
      </Grid>
      {/* <Grid item xs={12} lg={4.5}>
        <RiskDistribution contracts={contracts} />
      </Grid> */}
    </Grid>
  );
};

export default ContractMetrics;