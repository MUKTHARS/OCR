import React from 'react';
import {
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
  Divider,
} from '@mui/material';
import {
  GavelOutlined,
  SecurityOutlined,
  BalanceOutlined,
  ShieldOutlined,
} from '@mui/icons-material';

const LegalTermsCard = ({ contract }) => {
  const legalItems = [
    { label: 'Governing Law', value: contract.governing_law, icon: <BalanceOutlined fontSize="small" /> },
    { label: 'Jurisdiction', value: contract.jurisdiction, icon: <GavelOutlined fontSize="small" /> },
    { label: 'Auto Renewal', value: contract.auto_renewal ? 'Yes' : 'No', icon: '🔄' },
    { label: 'Renewal Notice', value: contract.renewal_notice_period ? `${contract.renewal_notice_period} days` : 'Not specified', icon: '📅' },
    { label: 'Termination Notice', value: contract.termination_notice_period ? `${contract.termination_notice_period} days` : 'Not specified', icon: '⚠️' },
  ];

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <GavelOutlined color="primary" fontSize="small" />
          <Typography variant="h6" fontWeight={600}>
            Legal Terms
          </Typography>
        </Box>
        <Divider sx={{ mb: 2 }} />
        <Grid container spacing={2}>
          {legalItems.map((item, idx) => (
            <Grid item xs={6} key={idx}>
              <Box sx={{ 
                p: 2, 
                bgcolor: 'background.default',
                borderRadius: 2,
                border: '1px solid',
                borderColor: 'divider',
                height: '100%',
              }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  {typeof item.icon === 'string' ? (
                    <Typography variant="caption" sx={{ fontSize: '1.25rem' }}>
                      {item.icon}
                    </Typography>
                  ) : (
                    item.icon
                  )}
                  <Typography variant="caption" color="text.secondary">
                    {item.label}
                  </Typography>
                </Box>
                <Typography variant="body1" fontWeight={600}>
                  {item.value || 'Not specified'}
                </Typography>
              </Box>
            </Grid>
          ))}
        </Grid>
      </CardContent>
    </Card>
  );
};

const SecurityComplianceCard = ({ contract }) => {
  const complianceItems = [
    { 
      label: 'Confidentiality', 
      value: contract.confidentiality ? 'Required' : 'Not required',
      status: contract.confidentiality ? 'success' : 'default'
    },
    { 
      label: 'Indemnification', 
      value: contract.indemnification ? 'Required' : 'Not required',
      status: contract.indemnification ? 'warning' : 'default'
    },
    { 
      label: 'Liability Cap', 
      value: contract.liability_cap || 'Not specified',
      status: 'info'
    },
    { 
      label: 'Insurance Requirements', 
      value: contract.insurance_requirements || 'Not specified',
      status: 'info'
    },
  ];

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <SecurityOutlined color="primary" fontSize="small" />
          <Typography variant="h6" fontWeight={600}>
            Security & Compliance
          </Typography>
        </Box>
        <Divider sx={{ mb: 2 }} />
        <Grid container spacing={2}>
          {complianceItems.map((item, idx) => (
            <Grid item xs={6} key={idx}>
              <Box sx={{ 
                p: 2,
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 2,
                height: '100%',
              }}>
                <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                  {item.label}
                </Typography>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="body1" fontWeight={600}>
                    {item.value}
                  </Typography>
                  {item.status !== 'default' && (
                    <ShieldOutlined 
                      fontSize="small" 
                      color={item.status} 
                      sx={{ opacity: 0.7 }}
                    />
                  )}
                </Box>
              </Box>
            </Grid>
          ))}
        </Grid>
      </CardContent>
    </Card>
  );
};

const ContractLegal = ({ contract }) => {
  return (
    <Grid container spacing={3}>
      <Grid item xs={12} md={6}>
        <LegalTermsCard contract={contract} />
      </Grid>

      <Grid item xs={12} md={6}>
        <SecurityComplianceCard contract={contract} />
      </Grid>
    </Grid>
  );
};

export default ContractLegal;