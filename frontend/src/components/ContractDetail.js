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
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  CardContent,
  Divider,
  Alert,
  Tabs,
  Tab,
  IconButton,
  Tooltip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import HistoryIcon from '@mui/icons-material/History';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import TimelineIcon from '@mui/icons-material/Timeline';
import PersonIcon from '@mui/icons-material/Person';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import GavelIcon from '@mui/icons-material/Gavel';
import SecurityIcon from '@mui/icons-material/Security';
import { getContract, reviewContract, getContractVersions, getContractDeltas } from '../services/api';
import AssessmentIcon from '@mui/icons-material/Assessment';
import SpeedIcon from '@mui/icons-material/Speed';
import DescriptionIcon from '@mui/icons-material/Description';
import TableChartIcon from '@mui/icons-material/TableChart';
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

  const formatDate = (dateString) => {
    if (!dateString) return 'Not specified';
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatCurrency = (value, currency) => {
    if (!value) return 'N/A';
    return `${currency || 'USD'} ${value.toLocaleString()}`;
  };

  const getSeverityColor = (severity) => {
    const colors = {
      critical: 'error',
      high: 'error',
      medium: 'warning',
      low: 'success'
    };
    return colors[severity?.toLowerCase()] || 'default';
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
    <Box sx={{ p: 3 }}>
      {/* Header with Risk Score */}
      <Paper sx={{ p: 3, mb: 3, bgcolor: 'background.default' }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={8}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
              <Typography variant="h4">
                {contract.contract_type}
              </Typography>
              {contract.contract_subtype && (
                <Chip label={contract.contract_subtype} size="small" variant="outlined" />
              )}
              {contract.master_agreement_id && (
                <Chip 
                  label={`Master: ${contract.master_agreement_id}`}
                  size="small"
                  color="info"
                  variant="outlined"
                />
              )}
            </Box>
            
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
              <Chip
                label={`Risk: ${getRiskLabel(contract.risk_score)}`}
                color={getRiskColor(contract.risk_score)}
                size="small"
              />
              <Chip
                label={`Confidence: ${Math.round(contract.confidence_score * 100)}%`}
                color={contract.confidence_score >= 0.9 ? 'success' : contract.confidence_score >= 0.7 ? 'warning' : 'error'}
                size="small"
              />
              <Chip
                label={`Version: ${contract.version}`}
                size="small"
                variant="outlined"
              />
              {contract.needs_review ? (
                <Chip
                  icon={<WarningIcon />}
                  label="Needs Review"
                  color="warning"
                  size="small"
                />
              ) : (
                <Chip
                  icon={<CheckCircleIcon />}
                  label="Reviewed"
                  color="success"
                  size="small"
                />
              )}
            </Box>
            
            <Typography variant="body2" color="text.secondary">
              Extracted: {formatDate(contract.extraction_date)}
              {contract.version > 1 && ` • Version ${contract.version}`}
            </Typography>
          </Grid>
          
          <Grid item xs={12} md={4}>
            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
              {versions.length > 1 && (
                <>
                  <Tooltip title="Version History">
                    <IconButton onClick={() => setActiveTab(4)}>
                      <HistoryIcon />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Compare Versions">
                    <IconButton onClick={() => handleVersionCompare(versions[0], versions[versions.length - 1])}>
                      <CompareArrowsIcon />
                    </IconButton>
                  </Tooltip>
                </>
              )}
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
          </Grid>
        </Grid>
      </Paper>

      {/* Tabs for Different Sections */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)}>
          <Tab label="Overview" />
          <Tab label="Financial" />
          <Tab label="Legal & Compliance" />
          <Tab label="Clauses" />
          <Tab label="Version History" />
          <Tab label="Raw View" />
        </Tabs>
      </Box>

      {/* Tab Content */}
      {activeTab === 0 && (
        <Grid container spacing={3}>
          {/* Parties & Dates */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <PersonIcon /> Parties Involved
                </Typography>
                <Divider sx={{ mb: 2 }} />
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {contract.parties?.map((party, idx) => (
                    <Paper key={idx} sx={{ p: 2, bgcolor: 'background.default' }}>
                      <Typography variant="body1" fontWeight="medium">{party}</Typography>
                    </Paper>
                  ))}
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>Key Dates</Typography>
                <Divider sx={{ mb: 2 }} />
                <Grid container spacing={2}>
                  {[
                    { label: 'Effective Date', value: contract.effective_date },
                    { label: 'Expiration Date', value: contract.expiration_date },
                    { label: 'Execution Date', value: contract.execution_date },
                    { label: 'Termination Date', value: contract.termination_date },
                  ].map((date, idx) => (
                    <Grid item xs={6} key={idx}>
                      <Typography variant="body2" color="text.secondary">{date.label}</Typography>
                      <Typography variant="body1" fontWeight="medium">
                        {formatDate(date.value)}
                      </Typography>
                    </Grid>
                  ))}
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          {/* Signatories & Contacts */}
          <Grid item xs={12} md={6}>
  <Card sx={{ mt: 2 }}>
    <CardContent>
      <Typography variant="h6" gutterBottom>Signatories & Contacts</Typography>
      <Divider sx={{ mb: 2 }} />
      
      {/* Signatories */}
      {contract.signatories && contract.signatories.length > 0 ? (
        <>
          <Typography variant="subtitle2" gutterBottom>Signatories:</Typography>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Title</TableCell>
                  <TableCell>Signature Date</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {contract.signatories.map((sig, idx) => (
                  <TableRow key={idx}>
                    <TableCell>{sig.name || 'N/A'}</TableCell>
                    <TableCell>{sig.title || 'N/A'}</TableCell>
                    <TableCell>
                      {sig.signature_date ? formatDate(sig.signature_date) : 'N/A'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      ) : (
        <Typography variant="body2" color="text.secondary">
          No signatories extracted
        </Typography>
      )}
      
      {/* Administrative Contacts */}
      {contract.contacts && contract.contacts.length > 0 && (
        <>
          <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
            Administrative Contacts:
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {contract.contacts.map((contact, idx) => (
              <Paper key={idx} sx={{ p: 1.5 }}>
                <Typography variant="body2">
                  <strong>{contact.type || 'Contact'}:</strong> {contact.name || 'N/A'}
                </Typography>
                {contact.email && (
                  <Typography variant="body2" color="text.secondary">
                    Email: {contact.email}
                  </Typography>
                )}
                {contact.phone && (
                  <Typography variant="body2" color="text.secondary">
                    Phone: {contact.phone}
                  </Typography>
                )}
              </Paper>
            ))}
          </Box>
        </>
      )}
    </CardContent>
  </Card>
</Grid>

          {/* Risk Factors */}
          {contract.risk_factors && contract.risk_factors.length > 0 && (
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <WarningIcon /> Risk Factors
                  </Typography>
                  <Divider sx={{ mb: 2 }} />
                  <Grid container spacing={2}>
                    {contract.risk_factors.map((risk, idx) => (
                      <Grid item xs={12} md={6} key={idx}>
                        <Paper sx={{ p: 2, borderLeft: 4, borderColor: `${getSeverityColor(risk.severity)}.main` }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                            <Typography variant="subtitle2">{risk.factor}</Typography>
                            <Chip
                              label={risk.severity}
                              size="small"
                              color={getSeverityColor(risk.severity)}
                            />
                          </Box>
                          {risk.mitigation && (
                            <Typography variant="body2" color="text.secondary">
                              <strong>Mitigation:</strong> {risk.mitigation}
                            </Typography>
                          )}
                        </Paper>
                      </Grid>
                    ))}
                  </Grid>
                </CardContent>
              </Card>
            </Grid>
          )}
        </Grid>
      )}

      {activeTab === 1 && (
        <Grid container spacing={3}>
          {/* Financial Details */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <AttachMoneyIcon /> Financial Information
                </Typography>
                <Divider sx={{ mb: 2 }} />
                <Grid container spacing={2}>
                  {[
                    { label: 'Total Value', value: formatCurrency(contract.total_value, contract.currency) },
                    { label: 'Currency', value: contract.currency || 'N/A' },
                    { label: 'Payment Terms', value: contract.payment_terms || 'Not specified' },
                    { label: 'Billing Frequency', value: contract.billing_frequency || 'Not specified' },
                  ].map((item, idx) => (
                    <Grid item xs={6} key={idx}>
                      <Typography variant="body2" color="text.secondary">{item.label}</Typography>
                      <Typography variant="body1" fontWeight="medium">{item.value}</Typography>
                    </Grid>
                  ))}
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          {/* Deliverables */}
          {contract.deliverables && contract.deliverables.length > 0 && (
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>Deliverables</Typography>
                  <Divider sx={{ mb: 2 }} />
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Item</TableCell>
                          <TableCell>Due Date</TableCell>
                          <TableCell>Milestone</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {contract.deliverables.map((deliverable, idx) => (
                          <TableRow key={idx}>
                            <TableCell>{deliverable.item}</TableCell>
                            <TableCell>{formatDate(deliverable.due_date)}</TableCell>
                            <TableCell>{deliverable.milestone || 'N/A'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </CardContent>
              </Card>
            </Grid>
          )}

          {/* Service Levels */}
          {contract.service_levels && Object.keys(contract.service_levels).length > 0 && (
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>Service Level Agreements</Typography>
                  <Divider sx={{ mb: 2 }} />
                  <Grid container spacing={2}>
                    {Object.entries(contract.service_levels).map(([kpi, details]) => (
                      <Grid item xs={12} md={6} key={kpi}>
                        <Paper sx={{ p: 2 }}>
                          <Typography variant="subtitle1" gutterBottom>{kpi}</Typography>
                          <Grid container spacing={1}>
                            <Grid item xs={6}>
                              <Typography variant="caption" color="text.secondary">Target</Typography>
                              <Typography variant="body2">{details.target || 'N/A'}</Typography>
                            </Grid>
                            <Grid item xs={6}>
                              <Typography variant="caption" color="text.secondary">Period</Typography>
                              <Typography variant="body2">{details.measurement_period || 'N/A'}</Typography>
                            </Grid>
                            {details.remedies && (
                              <Grid item xs={12}>
                                <Typography variant="caption" color="text.secondary">Remedies</Typography>
                                <Typography variant="body2">{details.remedies}</Typography>
                              </Grid>
                            )}
                          </Grid>
                        </Paper>
                      </Grid>
                    ))}
                  </Grid>
                </CardContent>
              </Card>
            </Grid>
          )}
        </Grid>
      )}

      {activeTab === 2 && (
        <Grid container spacing={3}>
          {/* Legal Terms */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <GavelIcon /> Legal Terms
                </Typography>
                <Divider sx={{ mb: 2 }} />
                <Grid container spacing={2}>
                  {[
                    { label: 'Governing Law', value: contract.governing_law },
                    { label: 'Jurisdiction', value: contract.jurisdiction },
                    { label: 'Auto Renewal', value: contract.auto_renewal ? 'Yes' : 'No' },
                    { label: 'Renewal Notice Period', value: contract.renewal_notice_period ? `${contract.renewal_notice_period} days` : 'Not specified' },
                    { label: 'Termination Notice Period', value: contract.termination_notice_period ? `${contract.termination_notice_period} days` : 'Not specified' },
                  ].map((term, idx) => (
                    <Grid item xs={6} key={idx}>
                      <Typography variant="body2" color="text.secondary">{term.label}</Typography>
                      <Typography variant="body1" fontWeight="medium">
                        {term.value || 'Not specified'}
                      </Typography>
                    </Grid>
                  ))}
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          {/* Security & Compliance */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <SecurityIcon /> Security & Compliance
                </Typography>
                <Divider sx={{ mb: 2 }} />
                <Grid container spacing={2}>
                  {[
                    { label: 'Confidentiality', value: contract.confidentiality ? 'Required' : 'Not required' },
                    { label: 'Indemnification', value: contract.indemnification ? 'Required' : 'Not required' },
                    { label: 'Liability Cap', value: contract.liability_cap || 'Not specified' },
                    { label: 'Insurance Requirements', value: contract.insurance_requirements || 'Not specified' },
                  ].map((item, idx) => (
                    <Grid item xs={6} key={idx}>
                      <Typography variant="body2" color="text.secondary">{item.label}</Typography>
                      <Typography variant="body1" fontWeight="medium">{item.value}</Typography>
                    </Grid>
                  ))}
                </Grid>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {activeTab === 3 && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>Extracted Clauses</Typography>
          <Divider sx={{ mb: 3 }} />
          
          {Object.entries(contract.clauses || {}).map(([clauseName, clauseData]) => (
            <Accordion key={clauseName}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="subtitle1">
                      {clauseName.replace(/_/g, ' ').toUpperCase()}
                    </Typography>
                    {clauseData.category && (
                      <Chip
                        label={clauseData.category}
                        size="small"
                        variant="outlined"
                        sx={{ mr: 1 }}
                      />
                    )}
                    {clauseData.risk_level && (
                      <Chip
                        label={`Risk: ${clauseData.risk_level}`}
                        size="small"
                        color={getSeverityColor(clauseData.risk_level)}
                      />
                    )}
                  </Box>
                  <Chip
                    label={`${Math.round(clauseData.confidence * 100)}%`}
                    size="small"
                    color={clauseData.confidence >= 0.9 ? 'success' : clauseData.confidence >= 0.7 ? 'warning' : 'error'}
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
      )}

      {activeTab === 4 && versions.length > 1 && (
        <Paper sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h6">Version History</Typography>
            <Button
              variant="outlined"
              startIcon={<CompareArrowsIcon />}
              onClick={() => handleVersionCompare(versions[0], versions[versions.length - 1])}
            >
              Compare All Versions
            </Button>
          </Box>
          
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Version</TableCell>
                  <TableCell>Extraction Date</TableCell>
                  <TableCell>Confidence</TableCell>
                  <TableCell>Risk Score</TableCell>
                  <TableCell>Changes</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {versions.map((version, index) => (
                  <TableRow key={version.id} hover>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body1" fontWeight="medium">v{version.version}</Typography>
                        {version.version === contract.version && (
                          <Chip label="Current" size="small" color="primary" />
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>{formatDate(version.extraction_date)}</TableCell>
                    <TableCell>
                      <Chip
                        label={`${Math.round(version.confidence_score * 100)}%`}
                        size="small"
                        color={version.confidence_score >= 0.9 ? 'success' : version.confidence_score >= 0.7 ? 'warning' : 'error'}
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={getRiskLabel(version.risk_score)}
                        color={getRiskColor(version.risk_score)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      {version.change_summary || 'Initial version'}
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        {index > 0 && (
                          <Tooltip title="Compare with previous">
                            <IconButton
                              size="small"
                              onClick={() => handleVersionCompare(versions[index - 1], version)}
                            >
                              <CompareArrowsIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                        <Tooltip title="View this version">
                          <IconButton size="small">
                            <HistoryIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {activeTab === 5 && (
  <Paper sx={{ p: 3, maxHeight: '70vh', overflow: 'auto' }}>
    <Typography variant="h6" gutterBottom>
      Complete Extracted Data (Raw View)
    </Typography>
    <Typography variant="body2" color="text.secondary" paragraph>
      All data extracted from the contract, including unstructured content.
    </Typography>
    
    <Accordion defaultExpanded>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography variant="subtitle1">Complete JSON Data</Typography>
      </AccordionSummary>
      <AccordionDetails>
        <pre style={{
          whiteSpace: 'pre-wrap',
          fontFamily: 'monospace',
          fontSize: '0.75rem',
          backgroundColor: '#f5f5f5',
          padding: '1rem',
          borderRadius: '4px',
          maxHeight: '400px',
          overflow: 'auto'
        }}>
          {JSON.stringify(contract, null, 2)}
        </pre>
      </AccordionDetails>
    </Accordion>
    
    <DynamicContractViewer contract={contract} />
  </Paper>
)}

      {/* Version Comparison Dialog */}
      <Dialog
        open={comparisonDialog}
        onClose={() => setComparisonDialog(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>
          Compare Contract Versions
          {selectedVersions.length === 2 && (
            <Typography variant="body2" color="text.secondary">
              v{selectedVersions[0].version} vs v{selectedVersions[1].version}
            </Typography>
          )}
        </DialogTitle>
        <DialogContent>
         // In the version comparison dialog, update the table rendering:
{selectedVersions.length === 2 && deltas.length > 0 ? (
    <Box>
        <Alert severity="info" sx={{ mb: 2 }}>
            <Typography variant="subtitle2">
                Found {deltas.length} changes between versions
            </Typography>
        </Alert>
        <TableContainer>
            <Table size="small">
                <TableHead>
                    <TableRow>
                        <TableCell>Field</TableCell>
                        <TableCell>Change Type</TableCell>
                        <TableCell>Previous Value</TableCell>
                        <TableCell>New Value</TableCell>
                        <TableCell>Impact</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {deltas.map((delta, idx) => (
                        <TableRow key={idx} hover>
                            <TableCell>
                                <Typography variant="body2" fontWeight="medium">
                                    {delta.field_name.replace(/\./g, ' → ')}
                                </Typography>
                            </TableCell>
                            <TableCell>
                                <Chip
                                    label={delta.change_type}
                                    size="small"
                                    color={
                                        delta.change_type === 'added' ? 'success' : 
                                        delta.change_type === 'removed' ? 'error' : 'warning'
                                    }
                                />
                            </TableCell>
                            <TableCell>
                                <Typography variant="body2" color="text.secondary">
                                    {delta.old_value ? 
                                        (typeof delta.old_value === 'string' ? 
                                            delta.old_value.slice(0, 100) : 
                                            JSON.stringify(delta.old_value).slice(0, 100)) : 
                                        '—'
                                    }
                                </Typography>
                            </TableCell>
                            <TableCell>
                                <Typography variant="body2" color="text.secondary">
                                    {delta.new_value ? 
                                        (typeof delta.new_value === 'string' ? 
                                            delta.new_value.slice(0, 100) : 
                                            JSON.stringify(delta.new_value).slice(0, 100)) : 
                                        '—'
                                    }
                                </Typography>
                            </TableCell>
                            <TableCell>
                                {getImpactLevel(delta.field_name, delta.change_type)}
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </TableContainer>
    </Box>
) : (
    <Alert severity="info" sx={{ mt: 2 }}>
        No changes detected between selected versions
    </Alert>
)}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setComparisonDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

// Helper functions
const getRiskColor = (score) => {
  if (score >= 0.7) return 'error';
  if (score >= 0.3) return 'warning';
  return 'success';
};

const getRiskLabel = (score) => {
  if (score >= 0.7) return 'High Risk';
  if (score >= 0.3) return 'Medium Risk';
  return 'Low Risk';
};

const DynamicContractViewer = ({ contract }) => {
  const [expandedSections, setExpandedSections] = useState({});
  
  const toggleSection = (sectionName) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionName]: !prev[sectionName]
    }));
  };
  
  const renderDynamicContent = () => {
    if (!contract) return null;
    
    const sections = [];
    
    // 1. Clauses (always present)
    if (contract.clauses && Object.keys(contract.clauses).length > 0) {
      sections.push({
        title: "Clauses & Provisions",
        content: renderClauses(contract.clauses),
        icon: <GavelIcon />,
        priority: "high"
      });
    }
    
    // 2. Payment Schedule (dynamic detection)
    if (contract.payment_schedule || contract.tables_and_schedules?.payment_schedule) {
      sections.push({
        title: "Payment Schedule",
        content: renderPaymentSchedule(contract),
        icon: <AttachMoneyIcon />,
        priority: "high"
      });
    }
    
    // 3. Reporting Requirements
    if (contract.compliance_requirements?.reporting_requirements || 
        hasReportingInClauses(contract.clauses)) {
      sections.push({
        title: "Reporting Requirements",
        content: renderReportingRequirements(contract),
        icon: <AssessmentIcon />,
        priority: "medium"
      });
    }
    
    // 4. Deliverables
    if (contract.deliverables && contract.deliverables.length > 0) {
      sections.push({
        title: "Deliverables",
        content: renderDeliverables(contract.deliverables),
        icon: <CheckCircleIcon />,
        priority: "high"
      });
    }
    
    // 5. Service Levels
    if (contract.service_levels && Object.keys(contract.service_levels).length > 0) {
      sections.push({
        title: "Service Level Agreements",
        content: renderServiceLevels(contract.service_levels),
        icon: <SpeedIcon />,
        priority: "medium"
      });
    }
    
    // 6. Risk Indicators
    if (contract.risk_indicators && Object.keys(contract.risk_indicators).length > 0) {
      sections.push({
        title: "Risk Indicators",
        content: renderRiskIndicators(contract.risk_indicators),
        icon: <WarningIcon />,
        priority: "high"
      });
    }
    
    // 7. Compliance Requirements
    if (contract.compliance_requirements && Object.keys(contract.compliance_requirements).length > 0) {
      sections.push({
        title: "Compliance Requirements",
        content: renderComplianceRequirements(contract.compliance_requirements),
        icon: <SecurityIcon />,
        priority: "medium"
      });
    }
    
    // 8. All extracted sections (dynamic)
    if (contract.extracted_sections && Object.keys(contract.extracted_sections).length > 0) {
      sections.push({
        title: "All Document Sections",
        content: renderAllSections(contract.extracted_sections),
        icon: <DescriptionIcon />,
        priority: "low"
      });
    }
    
    // 9. Tables and Schedules
    if (contract.tables_and_schedules && Object.keys(contract.tables_and_schedules).length > 0) {
      sections.push({
        title: "Tables & Schedules",
        content: renderTables(contract.tables_and_schedules),
        icon: <TableChartIcon />,
        priority: "medium"
      });
    }
    
    // 10. Key Fields
    if (contract.key_fields && Object.keys(contract.key_fields).length > 0) {
      sections.push({
        title: "Key Fields",
        content: renderKeyFields(contract.key_fields),
        // icon: <KeyIcon />,
        icon: <DescriptionIcon />,
        priority: "high"
      });
    }
    
    // Sort by priority
    const priorityOrder = { high: 1, medium: 2, low: 3 };
    sections.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
    
    return sections;
  };
  
  const renderPaymentSchedule = (contract) => {
    const schedule = contract.payment_schedule || 
                     JSON.parse(contract.tables_and_schedules?.payment_schedule || '[]');
    
    if (!schedule || schedule.length === 0) return null;
    
    return (
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Milestone / Description</TableCell>
              <TableCell align="right">Percentage</TableCell>
              <TableCell align="right">Amount</TableCell>
              <TableCell>Due Date</TableCell>
              <TableCell>Conditions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {schedule.map((item, idx) => (
              <TableRow key={idx}>
                <TableCell>{item.milestone || item.description}</TableCell>
                <TableCell align="right">
                  {item.percentage ? `${item.percentage}%` : 'N/A'}
                </TableCell>
                <TableCell align="right">
                  {item.amount ? `${contract.currency || 'USD'} ${item.amount.toLocaleString()}` : 'N/A'}
                </TableCell>
                <TableCell>{item.due_date || 'Not specified'}</TableCell>
                <TableCell>{item.conditions || 'None'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    );
  };
  // Add these functions inside the DynamicContractViewer component:

const renderKeyFields = (keyFields) => {
  if (!keyFields || Object.keys(keyFields).length === 0) return null;
  
  return (
    <Grid container spacing={2}>
      {Object.entries(keyFields).map(([fieldName, fieldData]) => (
        <Grid item xs={12} sm={6} md={4} key={fieldName}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                {fieldName.replace(/_/g, ' ')}
              </Typography>
              <Typography variant="body1" gutterBottom>
                {fieldData.value || 'Not found'}
              </Typography>
              {fieldData.confidence && (
                <Chip
                  label={`${Math.round(fieldData.confidence * 100)}% confidence`}
                  size="small"
                  color={fieldData.confidence >= 0.9 ? 'success' : fieldData.confidence >= 0.7 ? 'warning' : 'error'}
                />
              )}
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>
  );
};

const renderClauses = (clauses) => {
  if (!clauses || Object.keys(clauses).length === 0) return null;
  
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {Object.entries(clauses).map(([clauseName, clauseData]) => (
        <Accordion key={clauseName}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Typography variant="subtitle1">
                {clauseName.replace(/_/g, ' ').toUpperCase()}
              </Typography>
              {clauseData.confidence && (
                <Chip
                  label={`${Math.round(clauseData.confidence * 100)}%`}
                  size="small"
                  color={clauseData.confidence >= 0.9 ? 'success' : clauseData.confidence >= 0.7 ? 'warning' : 'error'}
                />
              )}
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
              {clauseData.text || JSON.stringify(clauseData, null, 2)}
            </Typography>
          </AccordionDetails>
        </Accordion>
      ))}
    </Box>
  );
};

const renderDeliverables = (deliverables) => {
  if (!deliverables || deliverables.length === 0) return null;
  
  return (
    <TableContainer component={Paper}>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Item</TableCell>
            <TableCell>Due Date</TableCell>
            <TableCell>Milestone</TableCell>
            <TableCell>Status</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {deliverables.map((item, idx) => (
            <TableRow key={idx}>
              <TableCell>{item.item || item.description}</TableCell>
              <TableCell>{item.due_date || 'Not specified'}</TableCell>
              <TableCell>{item.milestone || 'N/A'}</TableCell>
              <TableCell>{item.status || 'Pending'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

const renderServiceLevels = (serviceLevels) => {
  if (!serviceLevels || Object.keys(serviceLevels).length === 0) return null;
  
  return (
    <Grid container spacing={2}>
      {Object.entries(serviceLevels).map(([kpi, details]) => (
        <Grid item xs={12} md={6} key={kpi}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle1" gutterBottom>{kpi}</Typography>
            <Grid container spacing={1}>
              {details.target && (
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">Target</Typography>
                  <Typography variant="body2">{details.target}</Typography>
                </Grid>
              )}
              {details.measurement_period && (
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">Period</Typography>
                  <Typography variant="body2">{details.measurement_period}</Typography>
                </Grid>
              )}
              {details.remedies && (
                <Grid item xs={12}>
                  <Typography variant="caption" color="text.secondary">Remedies</Typography>
                  <Typography variant="body2">{details.remedies}</Typography>
                </Grid>
              )}
            </Grid>
          </Paper>
        </Grid>
      ))}
    </Grid>
  );
};

const renderRiskIndicators = (riskIndicators) => {
  if (!riskIndicators || Object.keys(riskIndicators).length === 0) return null;
  
  return (
    <Grid container spacing={2}>
      {Object.entries(riskIndicators).map(([indicator, value]) => (
        <Grid item xs={12} sm={6} md={4} key={indicator}>
          <Paper sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="body2">
              {indicator.replace(/_/g, ' ')}
            </Typography>
            {typeof value === 'boolean' ? (
              <Chip
                label={value ? 'Yes' : 'No'}
                color={value ? 'error' : 'success'}
                size="small"
              />
            ) : (
              <Typography variant="body1">{value}</Typography>
            )}
          </Paper>
        </Grid>
      ))}
    </Grid>
  );
};

const renderComplianceRequirements = (compliance) => {
  if (!compliance || Object.keys(compliance).length === 0) return null;
  
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {Object.entries(compliance).map(([requirement, value]) => (
        <Paper key={requirement} sx={{ p: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            {requirement.replace(/_/g, ' ').toUpperCase()}
          </Typography>
          {Array.isArray(value) ? (
            <List dense>
              {value.map((item, idx) => (
                <ListItem key={idx}>
                  <ListItemText primary={item} />
                </ListItem>
              ))}
            </List>
          ) : (
            <Typography variant="body2">{value.toString()}</Typography>
          )}
        </Paper>
      ))}
    </Box>
  );
};
  const renderReportingRequirements = (contract) => {
    const reporting = contract.compliance_requirements?.reporting_requirements || 
                      extractReportingFromClauses(contract.clauses);
    
    if (!reporting || reporting.length === 0) return null;
    
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {Array.isArray(reporting) ? (
          <List>
            {reporting.map((req, idx) => (
              <ListItem key={idx}>
                <ListItemIcon>
                  <DescriptionIcon />
                </ListItemIcon>
                <ListItemText 
                  primary={typeof req === 'string' ? req : req.type}
                  secondary={typeof req === 'object' ? req.details : 'Reporting requirement'}
                />
              </ListItem>
            ))}
          </List>
        ) : (
          <Typography variant="body1">{reporting}</Typography>
        )}
      </Box>
    );
  };
  
  const renderAllSections = (sections) => {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {Object.entries(sections).map(([sectionName, sectionData]) => (
          <Accordion key={sectionName}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="subtitle1">
                {sectionName.replace(/_/g, ' ').toUpperCase()}
                {sectionData.category && (
                  <Chip 
                    label={sectionData.category} 
                    size="small" 
                    sx={{ ml: 2 }}
                  />
                )}
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                {sectionData.text}
              </Typography>
              {sectionData.page_number && (
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                  Source: Page {sectionData.page_number}
                </Typography>
              )}
            </AccordionDetails>
          </Accordion>
        ))}
      </Box>
    );
  };
  
  const renderTables = (tables) => {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {Object.entries(tables).map(([tableName, tableData]) => (
          <Card key={tableName} variant="outlined">
            <CardContent>
              <Typography variant="h6" gutterBottom>
                {tableName.replace(/_/g, ' ').toUpperCase()}
              </Typography>
              {typeof tableData === 'string' ? (
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
                  {tableData}
                </Typography>
              ) : (
                <pre style={{ 
                  whiteSpace: 'pre-wrap', 
                  fontFamily: 'monospace',
                  fontSize: '0.875rem',
                  backgroundColor: '#f5f5f5',
                  padding: '1rem',
                  borderRadius: '4px'
                }}>
                  {JSON.stringify(tableData, null, 2)}
                </pre>
              )}
            </CardContent>
          </Card>
        ))}
      </Box>
    );
  };
  
  // Helper functions
  const hasReportingInClauses = (clauses) => {
    if (!clauses) return false;
    return Object.keys(clauses).some(key => 
      key.toLowerCase().includes('report') || 
      (clauses[key]?.text && clauses[key].text.toLowerCase().includes('report'))
    );
  };
  
const extractReportingFromClauses = (clauses) => {
  if (!clauses || typeof clauses !== 'object') {
    return [];
  }
  
  const reportingKeywords = ['report', 'audit', 'submit', 'deliverable', 'milestone'];
  
  return Object.entries(clauses)
    .filter(([clauseName, clauseData]) => {
      // Add null/undefined checks
      if (!clauseName || !clauseData) {
        return false;
      }
      
      const nameLower = clauseName.toLowerCase();
      const text = clauseData.text || '';
      const textLower = text.toLowerCase();
      
      return reportingKeywords.some(keyword => 
        nameLower.includes(keyword) || textLower.includes(keyword)
      );
    })
    .map(([clauseName, clauseData]) => ({
      name: clauseName,
      text: clauseData.text || '',
      category: clauseData.category || 'Reporting'
    }));
};
  
  const dynamicSections = renderDynamicContent();
  
  return (
    <Box sx={{ mt: 3 }}>
      <Typography variant="h5" gutterBottom>
        Dynamic Contract Analysis
      </Typography>
      <Typography variant="body2" color="text.secondary" paragraph>
        All extracted sections from the contract. Click to expand.
      </Typography>
      
      {dynamicSections.map((section, idx) => (
        <Card key={idx} sx={{ mb: 3 }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              {section.icon}
              <Typography variant="h6" sx={{ ml: 1 }}>
                {section.title}
              </Typography>
              <Chip 
                label={section.priority.toUpperCase()} 
                size="small"
                color={section.priority === 'high' ? 'error' : section.priority === 'medium' ? 'warning' : 'default'}
                sx={{ ml: 2 }}
              />
            </Box>
            {section.content}
          </CardContent>
        </Card>
      ))}
    </Box>
  );
};

export default ContractDetail;