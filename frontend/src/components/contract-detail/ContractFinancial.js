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
} from '@mui/material';
import {
  AttachMoneyOutlined,
  ScheduleOutlined,
  TrendingUpOutlined,
  CheckCircleOutlined,
} from '@mui/icons-material';
import { formatCurrency, formatDate } from '../contract-detail/ContractUtils';

const FinancialCard = ({ contract }) => {
  const financialItems = [
    { label: 'Total Value', value: formatCurrency(contract.total_value, contract.currency) },
    { label: 'Currency', value: contract.currency || 'USD' },
    { label: 'Payment Terms', value: contract.payment_terms || 'Not specified' },
    { label: 'Billing Frequency', value: contract.billing_frequency || 'Not specified' },
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
            <Grid item xs={6} key={idx}>
              <Box sx={{ 
                p: 2, 
                bgcolor: 'background.default',
                borderRadius: 2,
                border: '1px solid',
                borderColor: 'divider',
                height: '100%',
              }}>
                <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                  {item.label}
                </Typography>
                <Typography variant="body1" fontWeight={600}>
                  {item.value}
                </Typography>
              </Box>
            </Grid>
          ))}
        </Grid>
      </CardContent>
    </Card>
  );
};

const DeliverablesCard = ({ deliverables = [] }) => {
  if (deliverables.length === 0) return null;

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <CheckCircleOutlined color="primary" fontSize="small" />
          <Typography variant="h6" fontWeight={600}>
            Deliverables
          </Typography>
          <Box sx={{ flex: 1 }} />
          <Typography variant="caption" color="text.secondary">
            {deliverables.length} item{deliverables.length !== 1 ? 's' : ''}
          </Typography>
        </Box>
        <Divider sx={{ mb: 2 }} />
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Item</TableCell>
                <TableCell>Due Date</TableCell>
                <TableCell>Milestone</TableCell>
                <TableCell align="right">Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {deliverables.map((deliverable, idx) => (
                <TableRow key={idx} hover>
                  <TableCell>
                    <Typography variant="body2" fontWeight={500}>
                      {deliverable.item}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <ScheduleOutlined fontSize="small" color="action" />
                      <Typography variant="body2">
                        {formatDate(deliverable.due_date)}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {deliverable.milestone || 'N/A'}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Box 
                      sx={{ 
                        display: 'inline-block',
                        px: 1.5,
                        py: 0.5,
                        borderRadius: 4,
                        bgcolor: 'success.50',
                        color: 'success.main',
                        fontSize: '0.75rem',
                        fontWeight: 500,
                      }}
                    >
                      Pending
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </CardContent>
    </Card>
  );
};

const ServiceLevelsCard = ({ serviceLevels = {} }) => {
  if (Object.keys(serviceLevels).length === 0) return null;

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <TrendingUpOutlined color="primary" fontSize="small" />
          <Typography variant="h6" fontWeight={600}>
            Service Level Agreements
          </Typography>
        </Box>
        <Divider sx={{ mb: 2 }} />
        <Grid container spacing={2}>
          {Object.entries(serviceLevels).map(([kpi, details]) => (
            <Grid item xs={12} md={6} key={kpi}>
              <Paper sx={{ 
                p: 2,
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 2,
                height: '100%',
              }}>
                <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                  {kpi}
                </Typography>
                <Grid container spacing={1}>
                  {details.target && (
                    <Grid item xs={6}>
                      <Typography variant="caption" color="text.secondary" display="block">
                        Target
                      </Typography>
                      <Typography variant="body2" fontWeight={500}>
                        {details.target}
                      </Typography>
                    </Grid>
                  )}
                  {details.measurement_period && (
                    <Grid item xs={6}>
                      <Typography variant="caption" color="text.secondary" display="block">
                        Period
                      </Typography>
                      <Typography variant="body2">
                        {details.measurement_period}
                      </Typography>
                    </Grid>
                  )}
                  {details.remedies && (
                    <Grid item xs={12} sx={{ mt: 1 }}>
                      <Typography variant="caption" color="text.secondary" display="block">
                        Remedies
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {details.remedies}
                      </Typography>
                    </Grid>
                  )}
                </Grid>
              </Paper>
            </Grid>
          ))}
        </Grid>
      </CardContent>
    </Card>
  );
};

const ContractFinancial = ({ contract }) => {
  return (
    <Grid container spacing={3}>
      <Grid item xs={12} md={6}>
        <FinancialCard contract={contract} />
      </Grid>

      {contract.deliverables && contract.deliverables.length > 0 && (
        <Grid item xs={12} md={6}>
          <DeliverablesCard deliverables={contract.deliverables} />
        </Grid>
      )}

      {contract.service_levels && Object.keys(contract.service_levels).length > 0 && (
        <Grid item xs={12}>
          <ServiceLevelsCard serviceLevels={contract.service_levels} />
        </Grid>
      )}
    </Grid>
  );
};

export default ContractFinancial;