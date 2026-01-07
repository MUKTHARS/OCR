import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Chip,
  Button,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Card,
  CardContent,
  Divider,
  Alert,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import { getContract, reviewContract } from '../services/api';

const ContractDetail = ({ contractId, onReviewUpdate }) => {
  const [contract, setContract] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (contractId) {
      fetchContract();
    }
  }, [contractId]);

  const fetchContract = async () => {
    setLoading(true);
    try {
      const data = await getContract(contractId);
      setContract(data);
    } catch (error) {
      console.error('Error fetching contract:', error);
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

  if (loading) {
    return <Typography>Loading contract details...</Typography>;
  }

  if (!contract) {
    return <Typography>Contract not found</Typography>;
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'Not specified';
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Box>
          <Typography variant="h4" gutterBottom>
            {contract.contract_type}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Chip
              label={`Confidence: ${Math.round(contract.confidence_score * 100)}%`}
              color={
                contract.confidence_score >= 0.9
                  ? 'success'
                  : contract.confidence_score >= 0.7
                  ? 'warning'
                  : 'error'
              }
            />
            {contract.needs_review ? (
              <Chip
                icon={<WarningIcon />}
                label="Needs Review"
                color="warning"
              />
            ) : (
              <Chip
                icon={<CheckCircleIcon />}
                label="Reviewed"
                color="success"
              />
            )}
          </Box>
        </Box>
        {contract.needs_review && (
          <Button
            variant="contained"
            color="primary"
            onClick={handleReview}
            startIcon={<CheckCircleIcon />}
          >
            Mark as Reviewed
          </Button>
        )}
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Contract Details
            </Typography>
            <Divider sx={{ mb: 2 }} />
            
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <Typography variant="body2" color="text.secondary">
                  Effective Date
                </Typography>
                <Typography variant="body1">
                  {formatDate(contract.effective_date)}
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2" color="text.secondary">
                  Expiration Date
                </Typography>
                <Typography variant="body1">
                  {formatDate(contract.expiration_date)}
                </Typography>
              </Grid>
              {contract.total_value && (
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">
                    Total Value
                  </Typography>
                  <Typography variant="body1">
                    {contract.currency} {contract.total_value.toLocaleString()}
                  </Typography>
                </Grid>
              )}
            </Grid>
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Parties Involved
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {contract.parties?.map((party, idx) => (
                <Chip key={idx} label={party} variant="outlined" />
              ))}
            </Box>
          </Paper>
        </Grid>

        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Extracted Clauses
            </Typography>
            <Divider sx={{ mb: 2 }} />
            
            {Object.entries(contract.clauses || {}).map(([clauseName, clauseData]) => (
              <Accordion key={clauseName}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Typography variant="subtitle1">
                      {clauseName.replace(/_/g, ' ').toUpperCase()}
                    </Typography>
                    <Chip
                      label={`${Math.round(clauseData.confidence * 100)}%`}
                      size="small"
                      color={
                        clauseData.confidence >= 0.9
                          ? 'success'
                          : clauseData.confidence >= 0.7
                          ? 'warning'
                          : 'error'
                      }
                    />
                  </Box>
                </AccordionSummary>
                <AccordionDetails>
                  <Typography
                    variant="body2"
                    sx={{
                      whiteSpace: 'pre-wrap',
                      fontFamily: 'monospace',
                      p: 2,
                      bgcolor: 'grey.50',
                      borderRadius: 1,
                    }}
                  >
                    {clauseData.text}
                  </Typography>
                </AccordionDetails>
              </Accordion>
            ))}
          </Paper>
        </Grid>

        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Key Fields
            </Typography>
            <Divider sx={{ mb: 2 }} />
            
            <Grid container spacing={2}>
              {Object.entries(contract.key_fields || {}).map(([fieldName, fieldData]) => (
                <Grid item xs={12} sm={6} md={4} key={fieldName}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        {fieldName.replace(/_/g, ' ')}
                      </Typography>
                      <Typography variant="body1" gutterBottom>
                        {fieldData.value || 'Not found'}
                      </Typography>
                      <Chip
                        label={`${Math.round(fieldData.confidence * 100)}% confidence`}
                        size="small"
                        color={
                          fieldData.confidence >= 0.9
                            ? 'success'
                            : fieldData.confidence >= 0.7
                            ? 'warning'
                            : 'error'
                        }
                      />
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default ContractDetail;