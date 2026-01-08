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
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  FolderOpen,
  Description,
  CompareArrows,
  CloudUpload,
  CheckCircle,
  ArrowBack,
  HourglassEmpty,
  Error as ErrorIcon,
  Warning,
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
  const [processingStatus, setProcessingStatus] = useState({});
  const [completedFiles, setCompletedFiles] = useState([]);
  const [showCompletionDialog, setShowCompletionDialog] = useState(false);
  const [overallProgress, setOverallProgress] = useState(0);

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

  // Function to poll document status
  const pollDocumentStatus = async (documentId, fileName, fileIndex, totalFiles) => {
    let attempts = 0;
    const maxAttempts = 120; // 6 minutes max (120 * 3 seconds)
    
    // Initialize status for this file
    setProcessingStatus(prev => ({
      ...prev,
      [fileIndex]: {
        fileName,
        status: 'uploading',
        message: 'Uploading to server...',
        progress: 10
      }
    }));
    
    while (attempts < maxAttempts) {
      try {
        attempts++;
        
        // Check if we have a document ID to poll
        if (!documentId) {
          // Wait and retry
          await new Promise(resolve => setTimeout(resolve, 3000));
          continue;
        }
        
        // Try to fetch document status
        const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:8000'}/documents/${documentId}/status`);
        
        if (response.ok) {
          const statusData = await response.json();
          
          // Calculate progress based on status
          let progress = 10;
          let message = 'Uploading...';
          let status = 'uploading';
          
          if (statusData.status === "processing") {
            progress = 30 + Math.min(50, (attempts * 0.5));
            message = `Processing chunks with AI... (Attempt ${attempts})`;
            status = 'processing';
            
            // Simulate chunk progress
            if (attempts % 5 === 0) {
              const chunkProgress = Math.min(8, Math.floor(attempts / 5));
              message = `Processing chunk ${chunkProgress}/8 with AI...`;
            }
          } else if (statusData.status === "completed") {
            progress = 100;
            message = 'Processing complete!';
            status = 'completed';
            
            // Update status
            setProcessingStatus(prev => ({
              ...prev,
              [fileIndex]: {
                fileName,
                status: 'completed',
                message: 'Amendment processed successfully',
                progress: 100
              }
            }));
            
            // Update completed files
            setCompletedFiles(prev => [...prev, { fileName, documentId, contractId: statusData.contract_id }]);
            
            // Update overall progress
            const newProgress = ((fileIndex + 1) / totalFiles) * 100;
            setOverallProgress(newProgress);
            
            return { success: true, documentId, contractId: statusData.contract_id };
          } else if (statusData.status.includes("failed")) {
            setProcessingStatus(prev => ({
              ...prev,
              [fileIndex]: {
                fileName,
                status: 'error',
                message: `Processing failed: ${statusData.status}`,
                progress: 0
              }
            }));
            return { success: false, error: statusData.status };
          }
          
          // Update status for this file
          setProcessingStatus(prev => ({
            ...prev,
            [fileIndex]: {
              fileName,
              status,
              message,
              progress
            }
          }));
          
          // Update overall progress
          const fileProgress = (fileIndex / totalFiles) * 100;
          const currentFileProgress = (progress / 100) * (100 / totalFiles);
          setOverallProgress(fileProgress + currentFileProgress);
        }
        
        // Wait before next poll
        await new Promise(resolve => setTimeout(resolve, 3000));
        
      } catch (error) {
        console.log(`Polling attempt ${attempts} failed for ${fileName}:`, error.message);
        
        // Update status with error
        setProcessingStatus(prev => ({
          ...prev,
          [fileIndex]: {
            fileName,
            status: 'error',
            message: `Connection error: ${error.message}`,
            progress: 0
          }
        }));
        
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
    
    // Timeout reached
    setProcessingStatus(prev => ({
      ...prev,
      [fileIndex]: {
        fileName,
        status: 'error',
        message: 'Processing timeout',
        progress: 0
      }
    }));
    
    return { success: false, error: 'Timeout' };
  };

  const handleUpload = async () => {
    if (!selectedFiles.length || !parentContract) return;

    setUploading(true);
    setCompletedFiles([]);
    setProcessingStatus({});
    setOverallProgress(0);
    
    try {
      const totalFiles = selectedFiles.length;
      let successfulUploads = 0;
      
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        
        try {
          // Update status for this file
          setProcessingStatus(prev => ({
            ...prev,
            [i]: {
              fileName: file.name,
              status: 'uploading',
              message: 'Starting upload...',
              progress: 0
            }
          }));
          
          const metadata = {
            is_amendment: true,
            parent_document_id: parentContract.id,
            amendment_type: amendmentType,
          };
          
          // Upload the file
          const result = await uploadDocumentWithMetadata(file, metadata);
          
          if (result && result.id) {
            // Start polling for this document
            const pollResult = await pollDocumentStatus(result.id, file.name, i, totalFiles);
            
            if (pollResult.success) {
              successfulUploads++;
            }
          } else {
            setProcessingStatus(prev => ({
              ...prev,
              [i]: {
                fileName: file.name,
                status: 'error',
                message: 'No document ID returned',
                progress: 0
              }
            }));
          }
          
        } catch (error) {
          console.error(`Error uploading file ${file.name}:`, error);
          setProcessingStatus(prev => ({
            ...prev,
            [i]: {
              fileName: file.name,
              status: 'error',
              message: `Upload failed: ${error.message}`,
              progress: 0
            }
          }));
        }
      }
      
      // After all files are processed
      setUploading(false);
      
      if (successfulUploads > 0) {
        // Show completion dialog
        setShowCompletionDialog(true);
        
        // Only call success callback if we want to redirect immediately
        // We'll let the user decide when to redirect
      } else {
        alert('All amendments failed to process. Please try again.');
      }
      
    } catch (error) {
      console.error('Upload error:', error);
      setUploading(false);
      alert(`Upload failed: ${error.message}`);
    }
  };

  const handleCompleteAndRedirect = () => {
    setShowCompletionDialog(false);
    
    // Reset form
    setSelectedFiles([]);
    setParentContract(null);
    setActiveStep(0);
    setProcessingStatus({});
    setCompletedFiles([]);
    setOverallProgress(0);
    
    // Call success callback to redirect
    if (onUploadSuccess && completedFiles.length > 0) {
      onUploadSuccess();
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
      label: 'Upload & Process',
      description: 'Upload amendments and wait for processing',
      icon: <CloudUpload />,
    },
  ];

  // Get status icon
  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return <CheckCircle color="success" />;
      case 'processing':
        return <HourglassEmpty color="primary" />;
      case 'error':
        return <ErrorIcon color="error" />;
      case 'uploading':
        return <CloudUpload color="info" />;
      default:
        return <HourglassEmpty color="disabled" />;
    }
  };

  // Get status color
  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return 'success.main';
      case 'processing':
        return 'primary.main';
      case 'error':
        return 'error.main';
      case 'uploading':
        return 'info.main';
      default:
        return 'text.disabled';
    }
  };

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
                                      {(file.size / 1024 / 1024).toFixed(2)} MB
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
                  {/* Processing Status Display */}
                  {uploading && (
                    <Card sx={{ mb: 3 }}>
                      <CardContent>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                          <Typography variant="h6">
                            Processing Amendments
                          </Typography>
                          <Typography variant="body2" color="primary">
                            {Math.round(overallProgress)}% Complete
                          </Typography>
                        </Box>
                        
                        <LinearProgress 
                          variant="determinate" 
                          value={overallProgress} 
                          sx={{ mb: 3, height: 10, borderRadius: 5 }}
                        />
                        
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                          Processing {selectedFiles.length} amendment file(s) as {amendmentType} to:
                          <br />
                          <strong>{parentContract?.contract_type} (v{parentContract?.version})</strong>
                        </Typography>
                        
                        <Box sx={{ maxHeight: 300, overflow: 'auto' }}>
                          {selectedFiles.map((file, idx) => {
                            const fileStatus = processingStatus[idx] || {
                              fileName: file.name,
                              status: 'pending',
                              message: 'Waiting to start...',
                              progress: 0
                            };
                            
                            return (
                              <Paper
                                key={idx}
                                sx={{
                                  p: 2,
                                  mb: 1,
                                  borderLeft: 4,
                                  borderColor: getStatusColor(fileStatus.status),
                                  bgcolor: fileStatus.status === 'processing' ? 'primary.50' : 
                                          fileStatus.status === 'completed' ? 'success.50' :
                                          fileStatus.status === 'error' ? 'error.50' : 'grey.50'
                                }}
                              >
                                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                                  {getStatusIcon(fileStatus.status)}
                                  <Typography variant="body2" sx={{ ml: 1, flex: 1 }}>
                                    {fileStatus.fileName}
                                  </Typography>
                                  <Chip
                                    label={fileStatus.status.toUpperCase()}
                                    size="small"
                                    color={
                                      fileStatus.status === 'completed' ? 'success' :
                                      fileStatus.status === 'processing' ? 'primary' :
                                      fileStatus.status === 'error' ? 'error' : 'default'
                                    }
                                  />
                                </Box>
                                
                                <Typography variant="caption" color="text.secondary">
                                  {fileStatus.message}
                                </Typography>
                                
                                {fileStatus.status === 'processing' && (
                                  <LinearProgress 
                                    variant="determinate" 
                                    value={fileStatus.progress} 
                                    sx={{ mt: 1, height: 4, borderRadius: 2 }}
                                  />
                                )}
                              </Paper>
                            );
                          })}
                        </Box>
                        
                        {Object.values(processingStatus).some(s => s.status === 'error') && (
                          <Alert severity="warning" sx={{ mt: 2 }}>
                            Some amendments failed to process. You can still view the successful ones.
                          </Alert>
                        )}
                      </CardContent>
                    </Card>
                  )}
                  
                  <Alert severity="warning" sx={{ mb: 3 }}>
                    <Typography variant="subtitle2">Ready to Upload</Typography>
                    <Typography variant="body2">
                      You are about to upload {selectedFiles.length} amendment file(s) as {amendmentType} to:
                    </Typography>
                    <Typography variant="body2" fontWeight="bold">
                      {parentContract?.contract_type} (v{parentContract?.version})
                    </Typography>
                    {uploading && (
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                        Please wait for all chunks to be processed by AI before navigating away.
                      </Typography>
                    )}
                  </Alert>

                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Button
                      variant="contained"
                      onClick={handleUpload}
                      disabled={uploading || !selectedFiles.length || !parentContract}
                      startIcon={uploading ? null : <CloudUpload />}
                    >
                      {uploading ? 'Processing...' : 'Upload Amendments'}
                    </Button>
                    
                    <Button
                      variant="outlined"
                      onClick={() => {
                        // Preview comparison - disabled during upload
                        console.log('Preview comparison');
                      }}
                      startIcon={<CompareArrows />}
                      disabled={uploading}
                    >
                      Preview Comparison
                    </Button>
                  </Box>
                </Box>
              )}

              <Box sx={{ mt: 2 }}>
                <Button
                  disabled={activeStep === 0 || uploading}
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
                    index === 3 ||
                    uploading
                  }
                >
                  {index === steps.length - 1 ? 'Finish' : 'Next'}
                </Button>
              </Box>
            </StepContent>
          </Step>
        ))}
      </Stepper>

      {activeStep === steps.length && !uploading && (
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

      {/* Completion Dialog */}
      <Dialog open={showCompletionDialog} onClose={() => setShowCompletionDialog(false)}>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CheckCircle color="success" />
            <Typography>Amendment Processing Complete</Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1" gutterBottom>
            {completedFiles.length} out of {selectedFiles.length} amendment(s) processed successfully.
          </Typography>
          
          <Box sx={{ mt: 2, mb: 2 }}>
            {completedFiles.map((file, idx) => (
              <Paper key={idx} sx={{ p: 1.5, mb: 1, bgcolor: 'success.50' }}>
                <Typography variant="body2">
                  ✓ {file.fileName}
                </Typography>
              </Paper>
            ))}
            
            {Object.values(processingStatus).filter(s => s.status === 'error').map((file, idx) => (
              <Paper key={idx} sx={{ p: 1.5, mb: 1, bgcolor: 'error.50' }}>
                <Typography variant="body2">
                  ✗ {file.fileName} - {file.message}
                </Typography>
              </Paper>
            ))}
          </Box>
          
          <Alert severity="info">
            <Typography variant="body2">
              All document chunks have been processed by AI. You can now view and compare the amendments.
            </Typography>
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowCompletionDialog(false)}>
            Stay Here
          </Button>
          <Button 
            variant="contained" 
            onClick={handleCompleteAndRedirect}
            disabled={completedFiles.length === 0}
          >
            View Amendments
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AmendmentUpload;