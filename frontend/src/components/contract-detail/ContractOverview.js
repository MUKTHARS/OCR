import React from 'react';
import {
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
  Paper,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Avatar,
  AvatarGroup,
  Chip,
} from '@mui/material';
import {
  PersonOutlined,
  CalendarTodayOutlined,
  EmailOutlined,
  PhoneOutlined,
  BusinessOutlined,
} from '@mui/icons-material';
import { formatDate, getSeverityColor } from '../contract-detail/ContractUtils';

const PartiesCard = ({ parties = [] }) => (
  <Card>
    <CardContent>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <PersonOutlined color="primary" fontSize="small" />
        <Typography variant="h6" fontWeight={600}>
          Parties Involved
        </Typography>
      </Box>
      <Divider sx={{ mb: 2 }} />
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {parties.map((party, idx) => (
          <Paper 
            key={idx} 
            sx={{ 
              p: 2, 
              bgcolor: 'background.default',
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 2,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Avatar sx={{ bgcolor: 'primary.100', color: 'primary.main', width: 40, height: 40 }}>
                <BusinessOutlined />
              </Avatar>
              <Typography variant="body1" fontWeight={600}>
                {party}
              </Typography>
            </Box>
          </Paper>
        ))}
      </Box>
    </CardContent>
  </Card>
);

const DatesCard = ({ dates }) => {
  const dateFields = [
    { label: 'Effective Date', value: dates.effective_date },
    { label: 'Expiration Date', value: dates.expiration_date },
    { label: 'Execution Date', value: dates.execution_date },
    { label: 'Termination Date', value: dates.termination_date },
  ];

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <CalendarTodayOutlined color="primary" fontSize="small" />
          <Typography variant="h6" fontWeight={600}>
            Key Dates
          </Typography>
        </Box>
        <Divider sx={{ mb: 2 }} />
        <Grid container spacing={2}>
          {dateFields.map((date, idx) => (
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
                  <Typography variant="caption" sx={{ fontSize: '1.25rem' }}>
                    {date.icon}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {date.label}
                  </Typography>
                </Box>
                <Typography variant="body1" fontWeight={600}>
                  {formatDate(date.value)}
                </Typography>
              </Box>
            </Grid>
          ))}
        </Grid>
      </CardContent>
    </Card>
  );
};

const SignatoriesCard = ({ signatories = [], contacts = [] }) => (
  <Card>
    <CardContent>
      <Typography variant="h6" fontWeight={600} gutterBottom>
        Signatories & Contacts
      </Typography>
      <Divider sx={{ mb: 2 }} />
      
      {/* Signatories */}
      {signatories.length > 0 ? (
        <>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            Signatories
          </Typography>
          <TableContainer sx={{ mb: 3 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Title</TableCell>
                  <TableCell>Signature Date</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {signatories.map((sig, idx) => (
                  <TableRow key={idx}>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.100', fontSize: '0.875rem' }}>
                          {sig.name?.charAt(0) || '?'}
                        </Avatar>
                        <Typography variant="body2" fontWeight={500}>
                          {sig.name || 'N/A'}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {sig.title || 'N/A'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {sig.signature_date ? formatDate(sig.signature_date) : 'N/A'}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      ) : (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          No signatories extracted
        </Typography>
      )}
      
      {/* Administrative Contacts */}
      {contacts.length > 0 && (
        <>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            Administrative Contacts
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {contacts.map((contact, idx) => (
              <Paper 
                key={idx} 
                sx={{ 
                  p: 2,
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 2,
                }}
              >
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Box>
                    <Typography variant="body2" fontWeight={600} gutterBottom>
                      {contact.type || 'Contact'}
                    </Typography>
                    <Typography variant="body1" gutterBottom>
                      {contact.name || 'N/A'}
                    </Typography>
                    {contact.email && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                        <EmailOutlined fontSize="small" color="action" />
                        <Typography variant="body2" color="text.secondary">
                          {contact.email}
                        </Typography>
                      </Box>
                    )}
                    {contact.phone && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <PhoneOutlined fontSize="small" color="action" />
                        <Typography variant="body2" color="text.secondary">
                          {contact.phone}
                        </Typography>
                      </Box>
                    )}
                  </Box>
                </Box>
              </Paper>
            ))}
          </Box>
        </>
      )}
    </CardContent>
  </Card>
);

const RiskFactorsCard = ({ riskFactors = [] }) => {
  if (riskFactors.length === 0) return null;

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <Typography variant="h6" fontWeight={600}>
            Risk Factors
          </Typography>
          <Chip 
            label={`${riskFactors.length} risk${riskFactors.length !== 1 ? 's' : ''}`}
            size="small"
            color="warning"
            variant="outlined"
          />
        </Box>
        <Divider sx={{ mb: 2 }} />
        <Grid container spacing={2}>
          {riskFactors.map((risk, idx) => (
            <Grid item xs={12} md={6} key={idx}>
              <Paper sx={{ 
                p: 2, 
                borderLeft: 4, 
                borderColor: `${getSeverityColor(risk.severity)}.main`,
                bgcolor: 'background.default',
                height: '100%',
              }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                  <Typography variant="subtitle2" fontWeight={600}>
                    {risk.factor}
                  </Typography>
                  <Chip
                    label={risk.severity}
                    size="small"
                    color={getSeverityColor(risk.severity)}
                    sx={{ fontWeight: 500 }}
                  />
                </Box>
                {risk.mitigation && (
                  <>
                    <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                      Mitigation:
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {risk.mitigation}
                    </Typography>
                  </>
                )}
              </Paper>
            </Grid>
          ))}
        </Grid>
      </CardContent>
    </Card>
  );
};

const ContractOverview = ({ contract }) => {
  return (
    <Grid container spacing={3}>
      <Grid item xs={12} md={6}>
        <PartiesCard parties={contract.parties} />
      </Grid>

      <Grid item xs={12} md={6}>
        <DatesCard 
          dates={{
            effective_date: contract.effective_date,
            expiration_date: contract.expiration_date,
            execution_date: contract.execution_date,
            termination_date: contract.termination_date,
          }}
        />
      </Grid>

      <Grid item xs={12}>
        <SignatoriesCard 
          signatories={contract.signatories || []}
          contacts={contract.contacts || []}
        />
      </Grid>

      {contract.risk_factors && contract.risk_factors.length > 0 && (
        <Grid item xs={12}>
          <RiskFactorsCard riskFactors={contract.risk_factors} />
        </Grid>
      )}
    </Grid>
  );
};

export default ContractOverview;