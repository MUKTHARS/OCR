import React from 'react';
import {
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  Chip,
  Alert,
} from '@mui/material';
import {
  AttachMoneyOutlined,
  ScheduleOutlined,
  TrendingUpOutlined,
  CheckCircleOutlined,
  PaymentOutlined,
  CalendarTodayOutlined,
  AssignmentOutlined,
  WarningOutlined,
} from '@mui/icons-material';
import { formatCurrency, formatDate } from '../contract-detail/ContractUtils';

const FinancialCard = ({ contract }) => {
  const financialItems = [
    { 
      label: 'Total Value', 
      value: formatCurrency(contract.total_value, contract.currency),
      icon: <AttachMoneyOutlined fontSize="small" />
    },
    { 
      label: 'Currency', 
      value: contract.currency || 'USD',
      icon: <AttachMoneyOutlined fontSize="small" />
    },
    { 
      label: 'Investment Period', 
      value: contract.investment_period || 'Not specified',
      icon: <ScheduleOutlined fontSize="small" />
    },
    { 
      label: 'Payment Terms', 
      value: contract.payment_terms || 'Net 30 days',
      icon: <PaymentOutlined fontSize="small" />
    },
    { 
      label: 'Billing Frequency', 
      value: contract.billing_frequency || 'Monthly',
      icon: <ScheduleOutlined fontSize="small" />
    },
    { 
      label: 'Due By', 
      value: contract.due_by_date ? formatDate(contract.due_by_date) : 'Not specified',
      icon: <CalendarTodayOutlined fontSize="small" />
    },
  ];

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <AttachMoneyOutlined color="primary" fontSize="small" />
          <Typography variant="h6" fontWeight={600}>
            Financial Information
          </Typography>
        </Box>
        <Divider sx={{ mb: 2 }} />
        <Grid container spacing={2}>
          {financialItems.map((item, idx) => (
            <Grid item xs={6} md={4} key={idx}>
              <Box sx={{ 
                p: 2, 
                bgcolor: 'background.default',
                borderRadius: 2,
                border: '1px solid',
                borderColor: 'divider',
                height: '100%',
              }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  {item.icon}
                  <Typography variant="caption" color="text.secondary" display="block">
                    {item.label}
                  </Typography>
                </Box>
                <Typography variant="body1" fontWeight={600}>
                  {item.value}
                </Typography>
              </Box>
            </Grid>
          ))}
        </Grid>
        
        {/* Payment Summary */}
        {contract.payment_summary && (
          <Box sx={{ mt: 3 }}>
            <Typography variant="subtitle2" fontWeight={600} gutterBottom>
              Payment Summary
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={6} md={3}>
                <Paper sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                  <Typography variant="caption" color="text.secondary" display="block">
                    Total Payments
                  </Typography>
                  <Typography variant="h6" fontWeight={600} color="primary">
                    {formatCurrency(contract.payment_summary.total_payments, contract.currency)}
                  </Typography>
                </Paper>
              </Grid>
              <Grid item xs={6} md={3}>
                <Paper sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                  <Typography variant="caption" color="text.secondary" display="block">
                    Amount Paid
                  </Typography>
                  <Typography variant="h6" fontWeight={600} color="success.main">
                    {formatCurrency(contract.payment_summary.amount_paid, contract.currency)}
                  </Typography>
                </Paper>
              </Grid>
              <Grid item xs={6} md={3}>
                <Paper sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                  <Typography variant="caption" color="text.secondary" display="block">
                    Pending
                  </Typography>
                  <Typography variant="h6" fontWeight={600} color="warning.main">
                    {formatCurrency(contract.payment_summary.amount_pending, contract.currency)}
                  </Typography>
                </Paper>
              </Grid>
              <Grid item xs={6} md={3}>
                <Paper sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                  <Typography variant="caption" color="text.secondary" display="block">
                    Next Payment
                  </Typography>
                  <Typography variant="h6" fontWeight={600}>
                    {formatDate(contract.payment_summary.next_payment_date) || 'N/A'}
                  </Typography>
                </Paper>
              </Grid>
            </Grid>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

const DeliverablesTable = ({ deliverables = [], payments = [] }) => {
  const combinedItems = [...deliverables, ...payments].sort((a, b) => {
    const dateA = new Date(a.due_date || a.payment_date || a.due_by_date || '9999-12-31');
    const dateB = new Date(b.due_date || b.payment_date || b.due_by_date || '9999-12-31');
    return dateA - dateB;
  });

  if (combinedItems.length === 0) {
    return (
      <Card>
        <CardContent>
          <Alert severity="info">
            No deliverables or payments scheduled for this contract.
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'completed':
      case 'paid':
        return 'success';
      case 'pending':
      case 'due soon':
        return 'warning';
      case 'overdue':
        return 'error';
      default:
        return 'default';
    }
  };

  const getActionNeeded = (item) => {
    const now = new Date();
    const dueDate = new Date(item.due_date || item.payment_date || item.due_by_date);
    const daysDiff = Math.floor((dueDate - now) / (1000 * 60 * 60 * 24));
    
    if (item.status?.toLowerCase() === 'completed' || item.status?.toLowerCase() === 'paid') {
      return 'Completed';
    } else if (daysDiff < 0) {
      return 'Overdue - Immediate action required';
    } else if (daysDiff <= 7) {
      return `Due in ${daysDiff} days - Prepare for payment`;
    } else if (daysDiff <= 30) {
      return `Due in ${daysDiff} days - Schedule review`;
    } else {
      return 'On track';
    }
  };

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CheckCircleOutlined color="primary" fontSize="small" />
            <Typography variant="h6" fontWeight={600}>
              Deliverables & Payments Schedule
            </Typography>
          </Box>
          <Chip 
            label={`${combinedItems.length} item${combinedItems.length !== 1 ? 's' : ''}`}
            size="small"
            color="primary"
            variant="outlined"
          />
        </Box>
        <Divider sx={{ mb: 2 }} />
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell width="25%">
                  <Typography variant="caption" fontWeight={600}>
                    Item / Description
                  </Typography>
                </TableCell>
                <TableCell width="15%">
                  <Typography variant="caption" fontWeight={600}>
                    Type
                  </Typography>
                </TableCell>
                <TableCell width="15%">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <CalendarTodayOutlined fontSize="small" />
                    <Typography variant="caption" fontWeight={600}>
                      Due Date
                    </Typography>
                  </Box>
                </TableCell>
                <TableCell width="15%" align="right">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, justifyContent: 'flex-end' }}>
                    <AttachMoneyOutlined fontSize="small" />
                    <Typography variant="caption" fontWeight={600}>
                      Amount
                    </Typography>
                  </Box>
                </TableCell>
                <TableCell width="15%">
                  <Typography variant="caption" fontWeight={600}>
                    Status
                  </Typography>
                </TableCell>
                <TableCell width="25%">
                  <Typography variant="caption" fontWeight={600}>
                    Actions Needed
                  </Typography>
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {combinedItems.map((item, idx) => (
                <TableRow key={idx} hover>
                  <TableCell>
                    <Typography variant="body2" fontWeight={500}>
                      {item.description || item.item || item.milestone || 'Payment'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {item.type || (item.amount ? 'Payment' : 'Deliverable')}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip 
                      label={item.type || (item.amount ? 'Payment' : 'Deliverable')}
                      size="small"
                      color={item.amount ? 'primary' : 'secondary'}
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <CalendarTodayOutlined fontSize="small" color="action" />
                      <Typography variant="body2">
                        {formatDate(item.due_date || item.payment_date || item.due_by_date)}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell align="right">
                    {item.amount && (
                      <Typography variant="body2" fontWeight={600}>
                        {formatCurrency(item.amount, item.currency)}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Chip 
                      label={item.status || 'Pending'}
                      size="small"
                      color={getStatusColor(item.status)}
                      variant="filled"
                    />
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {getActionNeeded(item).includes('Overdue') ? (
                        <WarningOutlined fontSize="small" color="error" />
                      ) : null}
                      <Typography variant="body2" color={
                        getActionNeeded(item).includes('Overdue') ? 'error.main' : 
                        getActionNeeded(item).includes('Due in') ? 'warning.main' : 'text.primary'
                      }>
                        {getActionNeeded(item)}
                      </Typography>
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        
        {/* Summary Section */}
        <Box sx={{ mt: 3, p: 2, bgcolor: 'grey.50', borderRadius: 2 }}>
          <Typography variant="subtitle2" fontWeight={600} gutterBottom>
            Quick Actions
          </Typography>
          <Grid container spacing={1}>
            <Grid item xs={12} sm={6} md={3}>
              <Button 
                variant="outlined" 
                size="small" 
                fullWidth
                startIcon={<AssignmentOutlined />}
              >
                View All Documents
              </Button>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Button 
                variant="outlined" 
                size="small" 
                fullWidth
                startIcon={<PaymentOutlined />}
              >
                Process Payment
              </Button>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Button 
                variant="outlined" 
                size="small" 
                fullWidth
                startIcon={<CalendarTodayOutlined />}
              >
                Set Reminder
              </Button>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Button 
                variant="contained" 
                size="small" 
                fullWidth
                startIcon={<CheckCircleOutlined />}
              >
                Mark Complete
              </Button>
            </Grid>
          </Grid>
        </Box>
      </CardContent>
    </Card>
  );
};

const InvestmentSummary = ({ contract }) => {
  const investmentData = [
    { label: 'Total Investment', value: contract.total_value, color: 'primary' },
    { label: 'Amount Disbursed', value: contract.amount_disbursed || 0, color: 'success' },
    { label: 'Amount Committed', value: contract.amount_committed || 0, color: 'info' },
    { label: 'Pending Disbursement', value: contract.pending_disbursement || 0, color: 'warning' },
  ];

  const calculatePercentage = (value) => {
    if (!contract.total_value || contract.total_value === 0) return 0;
    return Math.round((value / contract.total_value) * 100);
  };

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <TrendingUpOutlined color="primary" fontSize="small" />
          <Typography variant="h6" fontWeight={600}>
            Investment Summary
          </Typography>
        </Box>
        <Divider sx={{ mb: 2 }} />
        <Grid container spacing={2}>
          {investmentData.map((item, idx) => (
            <Grid item xs={6} md={3} key={idx}>
              <Paper sx={{ 
                p: 2, 
                border: '1px solid', 
                borderColor: 'divider', 
                borderRadius: 2,
                height: '100%',
                position: 'relative',
                overflow: 'hidden'
              }}>
                <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, bgcolor: `${item.color}.main` }} />
                <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                  {item.label}
                </Typography>
                <Typography variant="h5" fontWeight={600} color={`${item.color}.main`} gutterBottom>
                  {formatCurrency(item.value, contract.currency)}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Typography variant="caption" color="text.secondary">
                    {calculatePercentage(item.value)}% of total
                  </Typography>
                  {item.label === 'Pending Disbursement' && item.value > 0 && (
                    <Chip label="Action Required" size="small" color="warning" />
                  )}
                </Box>
              </Paper>
            </Grid>
          ))}
        </Grid>
      </CardContent>
    </Card>
  );
};

const ContractFinancial = ({ contract }) => {
  // Extract payment schedule from extracted_metadata if available
  const paymentSchedule = contract.extracted_metadata?.payment_schedule || [];
  
  return (
    <Grid container spacing={3}>
      <Grid item xs={12}>
        <FinancialCard contract={contract} />
      </Grid>

      <Grid item xs={12}>
        <InvestmentSummary contract={contract} />
      </Grid>

      <Grid item xs={12}>
        <DeliverablesTable 
          deliverables={contract.deliverables || []}
          payments={paymentSchedule}
        />
      </Grid>
    </Grid>
  );
};

export default ContractFinancial;