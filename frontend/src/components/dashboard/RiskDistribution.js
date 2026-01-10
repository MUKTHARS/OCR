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
} from '@mui/material';
import {
  TimelineOutlined,
  EventOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  ScheduleOutlined,
  ErrorOutlined,
  CalendarTodayOutlined,
  ArrowForwardOutlined,
} from '@mui/icons-material';
import { getContracts } from '../../services/api';

const RiskDistribution = ({ contracts: initialContracts }) => {
  const [contracts, setContracts] = useState(initialContracts || []);
  const [loading, setLoading] = useState(false);
  const [currentMonth] = useState(new Date().toLocaleString('default', { month: 'short' }));

  useEffect(() => {
    if (!initialContracts || initialContracts.length === 0) {
      fetchContracts();
    } else {
      setContracts(initialContracts);
    }
  }, [initialContracts]);

  const fetchContracts = async () => {
    setLoading(true);
    try {
      const data = await getContracts(0, 50);
      setContracts(data);
    } catch (error) {
      console.error('Error fetching contracts:', error);
    } finally {
      setLoading(false);
    }
  };

  // Helper function to safely parse date
  const parseDate = (dateString) => {
    if (!dateString) return null;
    try {
      // Handle ISO date strings
      if (typeof dateString === 'string') {
        // Remove timezone if present
        const cleanDate = dateString.split('T')[0];
        return new Date(cleanDate);
      }
      // If it's already a Date object
      if (dateString instanceof Date) {
        return dateString;
      }
      return null;
    } catch (e) {
      console.error('Error parsing date:', dateString, e);
      return null;
    }
  };

  // Helper function to get year from date
  const getYearFromDate = (dateString) => {
    const date = parseDate(dateString);
    return date ? date.getFullYear() : new Date().getFullYear();
  };

  // Process deliverables from contracts
  const getUpcomingMilestones = () => {
    const milestones = [];
    const now = new Date();
    const next30Days = new Date();
    next30Days.setDate(now.getDate() + 30);

    contracts.forEach(contract => {
      // Check deliverables
      if (contract.deliverables && Array.isArray(contract.deliverables)) {
        contract.deliverables.forEach(deliverable => {
          if (deliverable.due_date) {
            try {
              const dueDate = parseDate(deliverable.due_date);
              if (dueDate && dueDate >= now && dueDate <= next30Days) {
                milestones.push({
                  contractId: contract.id,
                  contractType: contract.contract_type || 'Unknown',
                  parties: contract.parties?.join(', ') || 'Unknown',
                  milestone: deliverable.milestone || deliverable.item || 'Milestone',
                  dueDate: deliverable.due_date,
                  status: deliverable.status || 'pending',
                  type: 'deliverable',
                  description: deliverable.acceptance_criteria || 'Report & Payment Schedule'
                });
              }
            } catch (e) {
              console.error('Error parsing deliverable date:', e);
            }
          }
        });
      }

      // Check payment schedules from extracted_metadata
      if (contract.extracted_metadata?.payment_schedule && Array.isArray(contract.extracted_metadata.payment_schedule)) {
        contract.extracted_metadata.payment_schedule.forEach(schedule => {
          if (schedule.due_date) {
            const dueDate = parseDate(schedule.due_date);
            if (dueDate && dueDate >= now && dueDate <= next30Days) {
              milestones.push({
                contractId: contract.id,
                contractType: contract.contract_type || 'Unknown',
                parties: contract.parties?.join(', ') || 'Unknown',
                milestone: schedule.milestone || 'Payment Due',
                dueDate: schedule.due_date,
                status: schedule.status || 'pending',
                type: 'payment',
                description: schedule.conditions || 'Payment schedule'
              });
            }
          }
        });
      }

      // Check for report milestones
      if (contract.contract_type) {
        const startYear = getYearFromDate(contract.effective_date);
        const endYear = getYearFromDate(contract.expiration_date);
        const contractKey = `${contract.contract_type} ${startYear} - ${endYear}`;
        
        // Generate monthly milestones for the next 3 months
        for (let i = 1; i <= 3; i++) {
          const futureDate = new Date();
          futureDate.setMonth(now.getMonth() + i);
          const monthName = futureDate.toLocaleString('default', { month: 'short' });
          
          milestones.push({
            contractId: contract.id,
            contractType: contract.contract_type,
            parties: contract.parties?.join(', ') || 'Unknown',
            milestone: `${monthName} ${contract.contract_type} Report`,
            dueDate: futureDate.toISOString().split('T')[0],
            status: 'upcoming',
            type: 'report',
            description: `${contract.contract_type} monthly report due`,
            contractKey: contractKey
          });
        }
      }
    });

    // Sort by due date
    return milestones.sort((a, b) => {
      const dateA = parseDate(a.dueDate);
      const dateB = parseDate(b.dueDate);
      if (!dateA || !dateB) return 0;
      return dateA - dateB;
    }).slice(0, 10);
  };

  // Get overdue milestones
  const getOverdueMilestones = () => {
    const overdue = [];
    const now = new Date();

    contracts.forEach(contract => {
      if (contract.deliverables && Array.isArray(contract.deliverables)) {
        contract.deliverables.forEach(deliverable => {
          if (deliverable.due_date && deliverable.status !== 'completed') {
            try {
              const dueDate = parseDate(deliverable.due_date);
              if (dueDate && dueDate < now) {
                const daysOverdue = Math.floor((now - dueDate) / (1000 * 60 * 60 * 24));
                overdue.push({
                  contractId: contract.id,
                  contractType: contract.contract_type || 'Unknown',
                  milestone: deliverable.milestone || deliverable.item || 'Milestone',
                  dueDate: deliverable.due_date,
                  daysOverdue: daysOverdue,
                  description: deliverable.acceptance_criteria || 'Overdue deliverable'
                });
              }
            } catch (e) {
              console.error('Error parsing overdue date:', e);
            }
          }
        });
      }
    });

    return overdue.sort((a, b) => b.daysOverdue - a.daysOverdue);
  };

  // Group milestones by contract
  const getMilestonesByContract = () => {
    const grouped = {};
    
    contracts.forEach(contract => {
      if (!contract.contract_type) return;
      
      const startYear = getYearFromDate(contract.effective_date);
      const endYear = getYearFromDate(contract.expiration_date);
      const key = `${contract.contract_type} ${startYear} - ${endYear}`;
      
      if (!grouped[key]) {
        grouped[key] = {
          contractType: contract.contract_type,
          startYear: startYear,
          endYear: endYear,
          milestones: []
        };
      }

      // Add deliverables as milestones
      if (contract.deliverables && Array.isArray(contract.deliverables)) {
        contract.deliverables.forEach(deliverable => {
          if (deliverable.due_date) {
            grouped[key].milestones.push({
              name: deliverable.milestone || deliverable.item,
              dueDate: deliverable.due_date,
              status: deliverable.status || 'pending',
              type: deliverable.acceptance_criteria?.toLowerCase().includes('report') ? 'report' : 'deliverable'
            });
          }
        });
      }

      // Add payment schedules from extracted_metadata
      if (contract.extracted_metadata?.payment_schedule && Array.isArray(contract.extracted_metadata.payment_schedule)) {
        contract.extracted_metadata.payment_schedule.forEach(schedule => {
          if (schedule.due_date) {
            grouped[key].milestones.push({
              name: schedule.milestone || 'Payment',
              dueDate: schedule.due_date,
              status: schedule.status || 'pending',
              type: 'payment',
              amount: schedule.amount
            });
          }
        });
      }
    });

    return grouped;
  };

  const upcomingMilestones = getUpcomingMilestones();
  const overdueMilestones = getOverdueMilestones();
  const milestonesByContract = getMilestonesByContract();

  const getStatusIcon = (status, dueDate) => {
    const now = new Date();
    const due = parseDate(dueDate);
    if (!due) return <ScheduleOutlined fontSize="small" color="info" />;
    
    if (status === 'completed') {
      return <CheckCircleOutlined fontSize="small" color="success" />;
    } else if (due < now) {
      return <ErrorOutlined fontSize="small" color="error" />;
    } else if ((due - now) / (1000 * 60 * 60 * 24) <= 7) {
      return <WarningOutlined fontSize="small" color="warning" />;
    } else {
      return <ScheduleOutlined fontSize="small" color="info" />;
    }
  };

  const getStatusColor = (status, dueDate) => {
    const now = new Date();
    const due = parseDate(dueDate);
    if (!due) return 'info';
    
    if (status === 'completed') return 'success';
    if (due < now) return 'error';
    if ((due - now) / (1000 * 60 * 60 * 24) <= 7) return 'warning';
    return 'info';
  };

  if (loading) {
    return (
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
            <TimelineOutlined sx={{ mr: 1.5, color: 'primary.main' }} />
            <Typography variant="h6" fontWeight={600}>
              Contract Milestones
            </Typography>
          </Box>
          <LinearProgress />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <TimelineOutlined sx={{ mr: 1.5, color: 'primary.main' }} />
          <Typography variant="h6" fontWeight={600}>
            Contract Milestones & Schedules
          </Typography>
          <Chip 
            label={`${currentMonth} ${new Date().getFullYear()}`}
            size="small"
            color="primary"
            sx={{ ml: 2 }}
          />
        </Box>

        {/* Overdue Alerts */}
        {overdueMilestones.length > 0 && (
          <Alert 
            severity="error" 
            icon={<WarningOutlined />}
            sx={{ mb: 3, borderRadius: 2 }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
              <Typography variant="body2" fontWeight={500}>
                {overdueMilestones.length} overdue milestone{overdueMilestones.length !== 1 ? 's' : ''}
              </Typography>
              <Typography variant="caption">
                Immediate attention required
              </Typography>
            </Box>
          </Alert>
        )}

        {/* Upcoming Milestones Table */}
        {upcomingMilestones.length > 0 ? (
          <TableContainer component={Paper} variant="outlined" sx={{ mb: 3, borderRadius: 2 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  {/* <TableCell>
                    <Typography variant="caption" fontWeight={600}>
                      Contract / Parties
                    </Typography>
                  </TableCell> */}
                  <TableCell>
                    <Typography variant="caption" fontWeight={600}>
                      Milestone
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" fontWeight={600}>
                      Due Date
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" fontWeight={600}>
                      Type
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="caption" fontWeight={600}>
                      Status
                    </Typography>
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {upcomingMilestones.slice(0, 5).map((milestone, index) => {
                  const displayDate = parseDate(milestone.dueDate);
                  return (
                    <TableRow 
                      key={index}
                      hover
                      sx={{ 
                        '&:last-child td, &:last-child th': { border: 0 },
                        bgcolor: getStatusColor(milestone.status, milestone.dueDate) === 'error' ? 'error.50' : 'inherit'
                      }}
                    >
                      {/* <TableCell>
                        <Box>
                          <Typography variant="caption" fontWeight={500} display="block">
                            {milestone.contractType}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" display="block" noWrap sx={{ maxWidth: 150 }}>
                            {milestone.parties}
                          </Typography>
                        </Box>
                      </TableCell> */}
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {getStatusIcon(milestone.status, milestone.dueDate)}
                          <Typography variant="caption">
                            {milestone.milestone}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <CalendarTodayOutlined fontSize="small" color="action" />
                          <Typography variant="caption">
                            {displayDate ? displayDate.toLocaleDateString() : 'Invalid date'}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label={milestone.type}
                          size="small"
                          variant="outlined"
                          color={
                            milestone.type === 'payment' ? 'primary' : 
                            milestone.type === 'report' ? 'secondary' : 'default'
                          }
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Chip 
                          label={
                            getStatusColor(milestone.status, milestone.dueDate) === 'error' ? 'Overdue' :
                            getStatusColor(milestone.status, milestone.dueDate) === 'warning' ? 'Due Soon' : 'Upcoming'
                          }
                          size="small"
                          color={getStatusColor(milestone.status, milestone.dueDate)}
                          variant="filled"
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        ) : (
          <Alert severity="info" sx={{ mb: 3, borderRadius: 2 }}>
            No upcoming milestones in the next 30 days.
          </Alert>
        )}

        {/* Contract Timeline View */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" fontWeight={600} gutterBottom>
            Active Contracts Timeline
          </Typography>
          
          <Grid container spacing={2}>
            {Object.entries(milestonesByContract).slice(0, 3).map(([key, data]) => {
              const monthMilestones = data.milestones.filter(m => m.type === 'report');
              const dueThisMonth = monthMilestones.filter(m => {
                const dueDate = parseDate(m.dueDate);
                if (!dueDate) return false;
                const now = new Date();
                return dueDate.getMonth() === now.getMonth() && dueDate.getFullYear() === now.getFullYear();
              }).length;

              return (
                <Grid item xs={12} sm={6} md={4} key={key}>
                  <Paper 
                    variant="outlined" 
                    sx={{ 
                      p: 2, 
                      borderRadius: 2,
                      borderColor: dueThisMonth > 0 ? 'warning.main' : 'divider',
                      borderWidth: dueThisMonth > 0 ? 2 : 1,
                    }}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                      <Box>
                        <Typography variant="body2" fontWeight={600}>
                          {data.contractType}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {data.startYear} - {data.endYear}
                        </Typography>
                      </Box>
                      {dueThisMonth > 0 && (
                        <Chip 
                          label={`${dueThisMonth} due`}
                          size="small"
                          color="warning"
                          icon={<WarningOutlined fontSize="small" />}
                        />
                      )}
                    </Box>
                    
                    <Box sx={{ mt: 1.5 }}>
                      <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                        Recent Activities:
                      </Typography>
                      {data.milestones.slice(0, 2).map((milestone, idx) => {
                        const dueDate = parseDate(milestone.dueDate);
                        return (
                          <Box 
                            key={idx} 
                            sx={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              gap: 1,
                              mb: 1,
                              p: 1,
                              borderRadius: 1,
                              bgcolor: 'grey.50'
                            }}
                          >
                            <EventOutlined fontSize="small" color="action" />
                            <Box sx={{ flex: 1 }}>
                              <Typography variant="caption" display="block">
                                {milestone.name}
                              </Typography>
                              {dueDate && (
                                <Typography variant="caption" color="text.secondary">
                                  Due: {dueDate.toLocaleDateString()}
                                </Typography>
                              )}
                            </Box>
                          </Box>
                        );
                      })}
                      
                      {data.milestones.length > 2 && (
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', mt: 1 }}>
                          <Typography variant="caption" color="primary">
                            +{data.milestones.length - 2} more
                          </Typography>
                          <ArrowForwardOutlined fontSize="small" sx={{ ml: 0.5 }} />
                        </Box>
                      )}
                    </Box>
                  </Paper>
                </Grid>
              );
            })}
          </Grid>
        </Box>

        {/* Summary Stats */}
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
            <Grid item xs={6} sm={3}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h6" fontWeight={600} color="primary.main">
                  {contracts.length}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Active Contracts
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h6" fontWeight={600} color={overdueMilestones.length > 0 ? 'error.main' : 'success.main'}>
                  {overdueMilestones.length}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Overdue
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h6" fontWeight={600} color="warning.main">
                  {upcomingMilestones.length}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Upcoming
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h6" fontWeight={600} color="info.main">
                  {Object.keys(milestonesByContract).length}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Contracts Tracked
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </Paper>
      </CardContent>
    </Card>
  );
};

export default RiskDistribution;