import React, { useState } from 'react';
import {
  Box,
  Button,
  Typography,
  Paper,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  TextField,
  Alert,
  Card,
  CardContent,
  Grid,
  IconButton,
  Chip,
} from '@mui/material';
import {
  FolderOpen,
  Description,
  CompareArrows,
  CloudUpload,
  CheckCircle,
  ArrowBack,
} from '@mui/icons-material';
import { useDropzone } from 'react-dropzone';
import { uploadDocumentWithMetadata, getContracts } from '../services/api';

const AmendmentUpload = ({ onUploadSuccess }) => {
  const [activeStep, setActiveStep] = useState(0);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [parentContract, setParentContract] = useState(null);
  const [amendmentType, setAmendmentType] = useState('modification');
  const [uploading, setUploading] = useState(false);
  const [existingContracts, setExistingContracts] = useState([]);

  // Load existing contracts on component mount
  React.useEffect(() => {
    fetchExistingContracts();
  }, []);

  const fetchExistingContracts = async () => {
    try {
      const contracts = await getContracts();
      setExistingContracts(contracts);
    } catch (error) {
      console.error('Error fetching contracts:', error);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (acceptedFiles) => {
      setSelectedFiles(acceptedFiles);
      if (acceptedFiles.length > 0) {
        setActiveStep(1);
      }
    },
    accept: {
      'application/pdf': ['.pdf'],
    },
    multiple: true,
  });

  const handleNext = () => {
    setActiveStep((prevStep) => prevStep + 1);
  };

  const handleBack = () => {
    setActiveStep((prevStep) => prevStep - 1);
  };

  const handleUpload = async () => {
    if (!selectedFiles.length || !parentContract) return;

    setUploading(true);
    try {
      for (const file of selectedFiles) {
        const metadata = {
          is_amendment: true,
          parent_document_id: parentContract.id,
          amendment_type: amendmentType,
        };
        
        await uploadDocumentWithMetadata(file, metadata);
      }
      
      setUploading(false);
      if (onUploadSuccess) {
        onUploadSuccess();
      }
      
      // Reset form
      setSelectedFiles([]);
      setParentContract(null);
      setActiveStep(0);
      
      alert('Amendment(s) uploaded successfully!');
      
    } catch (error) {
      console.error('Upload error:', error);
      setUploading(false);
      alert(`Upload failed: ${error.message}`);
    }
  };

  const steps = [
    {
      label: 'Select Amendment Files',
      description: 'Upload the amendment documents from your folder',
      icon: <FolderOpen />,
    },
    {
      label: 'Identify Parent Contract',
      description: 'Select which contract this amendment modifies',
      icon: <Description />,
    },
    {
      label: 'Configure Amendment',
      description: 'Specify amendment type and details',
      icon: <CompareArrows />,
    },
    {
      label: 'Upload & Compare',
      description: 'Upload amendments and enable comparison',
      icon: <CloudUpload />,
    },
  ];

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', mt: 4 }}>
      <Stepper activeStep={activeStep} orientation="vertical">
        {steps.map((step, index) => (
          <Step key={step.label}>
            <StepLabel
              StepIconComponent={() => (
                <Box sx={{ color: activeStep >= index ? 'primary.main' : 'grey.400' }}>
                  {step.icon}
                </Box>
              )}
            >
              <Typography variant="h6">{step.label}</Typography>
              <Typography variant="body2" color="text.secondary">
                {step.description}
              </Typography>
            </StepLabel>
            <StepContent>
              {index === 0 && (
                <Box>
                  <Paper
                    {...getRootProps()}
                    sx={{
                      border: '2px dashed',
                      borderColor: isDragActive ? 'primary.main' : 'grey.400',
                      borderRadius: 2,
                      p: 4,
                      textAlign: 'center',
                      cursor: 'pointer',
                      bgcolor: isDragActive ? 'action.hover' : 'background.paper',
                      '&:hover': { bgcolor: 'action.hover' },
                    }}
                  >
                    <input {...getInputProps()} />
                    <CloudUpload sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
                    <Typography variant="h6" gutterBottom>
                      {isDragActive ? 'Drop amendment files here' : 'Drag & drop amendment files'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Supports PDF documents. You can select multiple files.
                    </Typography>
                    <Button variant="contained" sx={{ mt: 2 }}>
                      Browse Folder
                    </Button>
                  </Paper>

                  {selectedFiles.length > 0 && (
                    <Box sx={{ mt: 3 }}>
                      <Typography variant="subtitle2" gutterBottom>
                        Selected Files ({selectedFiles.length}):
                      </Typography>
                      <Grid container spacing={1}>
                        {selectedFiles.map((file, idx) => (
                          <Grid item xs={12} key={idx}>
                            <Card variant="outlined">
                              <CardContent sx={{ py: 1, '&:last-child': { pb: 1 } }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                  <Description color="action" />
                                  <Box sx={{ flex: 1 }}>
                                    <Typography variant="body2">{file.name}</Typography>
                                    <Typography variant="caption" color="text.secondary">
                                      {(file.size / 1024).toFixed(2)} KB
                                    </Typography>
                                  </Box>
                                  <IconButton
                                    size="small"
                                    onClick={() => {
                                      setSelectedFiles(selectedFiles.filter((_, i) => i !== idx));
                                    }}
                                  >
                                    <ArrowBack fontSize="small" />
                                  </IconButton>
                                </Box>
                              </CardContent>
                            </Card>
                          </Grid>
                        ))}
                      </Grid>
                    </Box>
                  )}
                </Box>
              )}

              {index === 1 && (
                <Box>
                  <FormControl fullWidth sx={{ mb: 3 }}>
                    <FormLabel>Search Parent Contract</FormLabel>
                    <TextField
                      select
                      value={parentContract?.id || ''}
                      onChange={(e) => {
                        const contract = existingContracts.find(c => c.id === parseInt(e.target.value));
                        setParentContract(contract || null);
                      }}
                      SelectProps={{ native: true }}
                      variant="outlined"
                      size="small"
                    >
                      <option value="">Select a parent contract...</option>
                      {existingContracts.map((contract) => (
                        <option key={contract.id} value={contract.id}>
                          {contract.contract_type} - {contract.parties?.join(' & ')} (v{contract.version})
                        </option>
                      ))}
                    </TextField>
                  </FormControl>

                  {parentContract && (
                    <Card sx={{ mt: 2 }}>
                      <CardContent>
                        <Typography variant="subtitle2" gutterBottom>
                          Selected Parent Contract:
                        </Typography>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                            <Typography variant="body2">Type:</Typography>
                            <Typography variant="body2" fontWeight="medium">
                              {parentContract.contract_type}
                            </Typography>
                          </Box>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                            <Typography variant="body2">Parties:</Typography>
                            <Typography variant="body2">
                              {parentContract.parties?.join(', ')}
                            </Typography>
                          </Box>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                            <Typography variant="body2">Version:</Typography>
                            <Chip label={`v${parentContract.version}`} size="small" />
                          </Box>
                        </Box>
                      </CardContent>
                    </Card>
                  )}
                </Box>
              )}

              {index === 2 && (
                <Box>
                  <FormControl component="fieldset" sx={{ mb: 3 }}>
                    <FormLabel>Amendment Type</FormLabel>
                    <RadioGroup
                      value={amendmentType}
                      onChange={(e) => setAmendmentType(e.target.value)}
                    >
                      <FormControlLabel value="modification" control={<Radio />} label="Modification" />
                      <FormControlLabel value="renewal" control={<Radio />} label="Renewal" />
                      <FormControlLabel value="extension" control={<Radio />} label="Extension" />
                      <FormControlLabel value="termination" control={<Radio />} label="Termination" />
                      <FormControlLabel value="correction" control={<Radio />} label="Correction" />
                      <FormControlLabel value="addendum" control={<Radio />} label="Addendum" />
                    </RadioGroup>
                  </FormControl>

                  <Alert severity="info">
                    <Typography variant="subtitle2">Version Tracking Enabled</Typography>
                    <Typography variant="body2">
                      This amendment will be automatically compared with the parent contract.
                      All changes will be tracked and highlighted for review.
                    </Typography>
                  </Alert>
                </Box>
              )}

              {index === 3 && (
                <Box>
                  <Alert severity="warning" sx={{ mb: 3 }}>
                    <Typography variant="subtitle2">Ready to Upload</Typography>
                    <Typography variant="body2">
                      You are about to upload {selectedFiles.length} amendment file(s) as {amendmentType} to:
                    </Typography>
                    <Typography variant="body2" fontWeight="bold">
                      {parentContract?.contract_type} (v{parentContract?.version})
                    </Typography>
                  </Alert>

                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Button
                      variant="contained"
                      onClick={handleUpload}
                      disabled={uploading}
                      startIcon={uploading ? null : <CloudUpload />}
                    >
                      {uploading ? 'Uploading...' : 'Upload Amendments'}
                    </Button>
                    
                    <Button
                      variant="outlined"
                      onClick={() => {
                        // Preview comparison
                        console.log('Preview comparison');
                      }}
                      startIcon={<CompareArrows />}
                    >
                      Preview Comparison
                    </Button>
                  </Box>
                </Box>
              )}

              <Box sx={{ mt: 2 }}>
                <Button
                  disabled={activeStep === 0}
                  onClick={handleBack}
                  sx={{ mr: 1 }}
                >
                  Back
                </Button>
                <Button
                  variant="contained"
                  onClick={handleNext}
                  disabled={
                    (index === 0 && selectedFiles.length === 0) ||
                    (index === 1 && !parentContract) ||
                    index === 3
                  }
                >
                  {index === steps.length - 1 ? 'Finish' : 'Next'}
                </Button>
              </Box>
            </StepContent>
          </Step>
        ))}
      </Stepper>

      {activeStep === steps.length && (
        <Paper square elevation={0} sx={{ p: 3 }}>
          <Box sx={{ textAlign: 'center' }}>
            <CheckCircle sx={{ fontSize: 48, color: 'success.main', mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              Amendment Upload Complete!
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              Your amendments have been uploaded and are ready for comparison.
              You can now use the comparison feature to review changes.
            </Typography>
            <Button
              variant="contained"
              onClick={() => {
                setActiveStep(0);
                setSelectedFiles([]);
                setParentContract(null);
              }}
            >
              Upload More Amendments
            </Button>
          </Box>
        </Paper>
      )}
    </Box>
  );
};

export default AmendmentUpload;