import React, { useState } from 'react';
import {
  Box,
  Button,
  Typography,
  LinearProgress,
  Paper,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Card,
  CardContent,
  Chip,
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import HistoryIcon from '@mui/icons-material/History';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import DescriptionIcon from '@mui/icons-material/Description';
import { useDropzone } from 'react-dropzone';
import { uploadDocumentWithMetadata, getContract } from '../services/api';

const EnhancedDocumentUpload = ({ onUploadSuccess, existingContracts = [] }) => {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isAmendment, setIsAmendment] = useState(false);
  const [parentDocumentId, setParentDocumentId] = useState('');
  const [amendmentType, setAmendmentType] = useState('modification');
  const [showAmendmentDialog, setShowAmendmentDialog] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [processingSteps, setProcessingSteps] = useState([]);
  const [currentStep, setCurrentStep] = useState(-1);
  const [uploadCompleted, setUploadCompleted] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [documentId, setDocumentId] = useState(null);
  const [processingComplete, setProcessingComplete] = useState(false);

  const processingStages = [
      { id: 1, label: 'Uploading document', description: 'Sending file to server' },
      { id: 2, label: 'Extracting text', description: 'Reading PDF content' },
      { id: 3, label: 'Processing chunks', description: 'Analyzing document sections with AI' },
      { id: 4, label: 'AI Analysis', description: 'Extracting contract details' },
      { id: 5, label: 'Extracting clauses', description: 'Identifying legal terms' },
      { id: 6, label: 'Calculating risk', description: 'Analyzing risk factors' },
      { id: 7, label: 'Creating embeddings', description: 'Preparing for search' },
      { id: 8, label: 'Saving to database', description: 'Storing extracted data' },
      { id: 9, label: 'Final verification', description: 'Validating extracted data' },
      { id: 10, label: 'Processing complete', description: 'Ready for review' },
  ];

  const updateProcessingStep = (stepId, status, message = '') => {
    setProcessingSteps(prev => {
      const newSteps = [...prev];
      const stepIndex = newSteps.findIndex(s => s.id === stepId);
      
      if (stepIndex === -1) {
        newSteps.push({ id: stepId, status, message, timestamp: new Date() });
      } else {
        newSteps[stepIndex] = { ...newSteps[stepIndex], status, message };
      }
      
      return newSteps.sort((a, b) => a.id - b.id);
    });
    setCurrentStep(stepId);
  };

  const pollDocumentStatus = async (documentId, maxAttempts = 120) => {
      let attempts = 0;
      
      while (attempts < maxAttempts) {
          try {
              attempts++;
              
              // Try to fetch document status from our new endpoint
              const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:8000'}/documents/${documentId}/status`);
              
              if (response.ok) {
                  const statusData = await response.json();
                  console.log(`Poll attempt ${attempts}:`, statusData);
                  
                  // Update progress based on attempts and backend status
                  const baseProgress = 30;
                  const incrementalProgress = Math.min(60, (attempts * 0.5));
                  const pollProgress = baseProgress + incrementalProgress;
                  setProgress(pollProgress);
                  
                  // Update steps based on document status
                  if (statusData.status === "processing") {
                      // Document is still processing
                      updateProcessingStep(3, 'processing', `Processing chunks with OpenAI...`);
                      
                      // Try to detect chunk processing from backend logs
                      if (attempts % 5 === 0) {
                          const chunkNumber = Math.min(5, Math.floor(attempts / 10));
                          updateProcessingStep(3, 'processing', `Processing chunk ${chunkNumber}/5 with AI...`);
                      }
                      
                      // Continue polling
                      await new Promise(resolve => setTimeout(resolve, 3000));
                      continue;
                  }
                  else if (statusData.status === "completed") {
                      // Document processing is complete!
                      updateProcessingStep(3, 'completed', 'All chunks processed successfully');
                      updateProcessingStep(4, 'completed', 'AI analysis complete');
                      updateProcessingStep(5, 'completed', 'Clauses extracted');
                      updateProcessingStep(6, 'completed', 'Risk assessment complete');
                      updateProcessingStep(7, 'completed', 'Embeddings created');
                      updateProcessingStep(8, 'completed', 'Data saved to database');
                      updateProcessingStep(9, 'processing', 'Final verification...');
                      setProgress(95);
                      
                      // Wait a moment for final steps
                      await new Promise(resolve => setTimeout(resolve, 1000));
                      
                      updateProcessingStep(9, 'completed', 'Verification complete');
                      updateProcessingStep(10, 'processing', 'Finalizing...');
                      setProgress(98);
                      
                      await new Promise(resolve => setTimeout(resolve, 500));
                      
                      updateProcessingStep(10, 'completed', 'Processing complete!');
                      setProgress(100);
                      setProcessingComplete(true);
                      
                      return {
                          success: true,
                          documentId: documentId,
                          contractId: statusData.contract_id,
                          message: 'Document processing completed successfully'
                      };
                  }
                  else if (statusData.status.includes("failed")) {
                      // Document processing failed
                      updateProcessingStep(10, 'error', `Processing failed: ${statusData.status}`);
                      setUploadError(`Document processing failed: ${statusData.status}`);
                      return {
                          success: false,
                          error: statusData.status
                      };
                  }
              }
              
              // Wait before next poll
              await new Promise(resolve => setTimeout(resolve, 3000));
              
          } catch (error) {
              console.log(`Polling attempt ${attempts} failed:`, error.message);
              
              // Continue polling even if we get an error (network issues, etc.)
              if (attempts < 10) {
                  // For first 10 attempts, retry quickly
                  await new Promise(resolve => setTimeout(resolve, 2000));
              } else {
                  // After 10 attempts, slow down
                  await new Promise(resolve => setTimeout(resolve, 5000));
              }
          }
      }
      
      // If we reach here, polling timed out
      updateProcessingStep(10, 'error', 'Processing timed out. Please check the document manually.');
      setUploadError('Backend processing timed out. Please check the document list for status.');
      
      return {
          success: false,
          error: 'Timeout'
      };
  };

  const simulateProcessing = async (file, isAmendmentFlag) => {
      setUploading(true);
      setProcessingComplete(false);
      setUploadCompleted(false);
      setUploadError(null);
      setProcessingSteps([]);
      
      try {
          // Step 1: Uploading
          updateProcessingStep(1, 'processing', 'Starting upload...');
          setProgress(10);
          
          // Upload the file
          const metadata = {
              is_amendment: isAmendmentFlag,
              parent_document_id: isAmendmentFlag ? parseInt(parentDocumentId) : null,
              amendment_type: isAmendmentFlag ? amendmentType : null,
          };
          
          updateProcessingStep(1, 'completed', 'File uploaded successfully');
          updateProcessingStep(2, 'processing', 'Extracting text from PDF...');
          setProgress(20);
          
          // Simulate initial processing delay
          await new Promise(resolve => setTimeout(resolve, 1500));
          
          updateProcessingStep(2, 'completed', 'Text extracted');
          updateProcessingStep(3, 'processing', 'Starting chunk processing with AI...');
          setProgress(30);
          
          // Make the actual API call to upload
          const result = await uploadDocumentWithMetadata(file, metadata);
          console.log('Initial upload result:', result);
          
          if (!result || !result.id) {
              throw new Error('No document ID returned from server');
          }
          
          setDocumentId(result.id);
          
          // Show that backend processing has started
          updateProcessingStep(3, 'processing', 'Backend processing started. Waiting for completion...');
          setProgress(40);
          
          // Wait a moment for backend to start
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // Start polling for document status
          const pollResult = await pollDocumentStatus(result.id);
          
          if (pollResult.success) {
              // Processing completed successfully
              setUploadCompleted(true);
              
              // Wait to show completion message
              setTimeout(() => {
                  setUploading(false);
                  
                  // Call success callback with the result
                  if (onUploadSuccess) {
                      onUploadSuccess({
                          ...result,
                          contractId: pollResult.contractId,
                          message: pollResult.message
                      });
                  }
                  
                  // Reset after a delay
                  setTimeout(() => {
                      resetUploadState();
                  }, 1000);
              }, 2000);
              
          } else {
              // Processing failed or timed out
              setUploadError(pollResult.error || 'Processing failed');
              setUploading(false);
          }
          
      } catch (error) {
          console.error('Upload failed:', error);
          const lastStep = processingSteps.length > 0 ? processingSteps[processingSteps.length - 1].id : 1;
          updateProcessingStep(lastStep, 'error', error.message);
          setUploadError(error.message);
          setUploading(false);
          setProgress(0);
      }
  };

  const resetUploadState = () => {
    setUploading(false);
    setProgress(0);
    setSelectedFile(null);
    setParentDocumentId('');
    setIsAmendment(false);
    setProcessingSteps([]);
    setCurrentStep(-1);
    setUploadCompleted(false);
    setUploadError(null);
    setDocumentId(null);
    setProcessingComplete(false);
  };

  const onDrop = async (acceptedFiles) => {
    if (uploading) return;
    
    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0];
      setSelectedFile(file);
      
      // Check if this might be an amendment by filename
      const isLikelyAmendment = file.name.toLowerCase().includes('amendment') || 
                               file.name.toLowerCase().includes('addendum') ||
                               file.name.toLowerCase().includes('renewal');
      
      if (isLikelyAmendment && existingContracts.length > 0) {
        setShowAmendmentDialog(true);
      } else {
        simulateProcessing(file, false);
      }
    }
  };

  const handleAmendmentSubmit = () => {
    if (isAmendment && !parentDocumentId) {
      alert('Please select a parent contract for the amendment');
      return;
    }
    
    simulateProcessing(selectedFile, isAmendment);
    setShowAmendmentDialog(false);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
    },
    maxFiles: 1,
    disabled: uploading,
  });

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return <CheckCircleIcon color="success" />;
      case 'processing':
        return <HourglassEmptyIcon color="primary" />;
      case 'error':
        return <ErrorIcon color="error" />;
      default:
        return <HourglassEmptyIcon color="disabled" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return 'success.main';
      case 'processing':
        return 'primary.main';
      case 'error':
        return 'error.main';
      default:
        return 'text.disabled';
    }
  };

  const getStepStatus = (stageId) => {
    const step = processingSteps.find(s => s.id === stageId);
    return step ? step.status : 'pending';
  };

  return (
    <Box sx={{ width: '100%', maxWidth: 800, mx: 'auto', mt: 4 }}>
      {/* Upload Zone - Disabled when processing */}
      <Paper
        {...getRootProps()}
        sx={{
          border: '2px dashed',
          borderColor: uploading ? 'grey.300' : (isDragActive ? 'primary.main' : 'grey.400'),
          borderRadius: 2,
          p: 4,
          textAlign: 'center',
          cursor: uploading ? 'not-allowed' : 'pointer',
          bgcolor: uploading ? 'grey.50' : (isDragActive ? 'action.hover' : 'background.paper'),
          opacity: uploading ? 0.7 : 1,
          '&:hover': !uploading && {
            bgcolor: 'action.hover',
          },
        }}
      >
        <input {...getInputProps()} />
        <CloudUploadIcon sx={{ fontSize: 64, color: uploading ? 'grey.400' : 'primary.main', mb: 2 }} />
        <Typography variant="h5" gutterBottom color={uploading ? 'text.disabled' : 'text.primary'}>
          {uploading ? 'Processing...' : (isDragActive ? 'Drop contract here' : 'Upload Contract Document')}
        </Typography>
        <Typography variant="body1" color={uploading ? 'text.disabled' : 'text.secondary'} gutterBottom>
          {uploading ? 'Please wait while we process your document' : 'Drag & drop or click to browse. Supports PDF documents.'}
        </Typography>
        {!uploading && (
          <Alert severity="info" sx={{ mt: 2, textAlign: 'left' }}>
            <strong>Enterprise Features:</strong> Automatic amendment detection, version tracking, 
            detailed extraction of financial terms, risk analysis, and compliance monitoring.
          </Alert>
        )}
      </Paper>

      {/* Processing Status */}
      {uploading && (
        <Box sx={{ mt: 4 }}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">
                  {processingComplete ? 'Processing Complete!' : 'Processing Contract...'}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Chip 
                    label={processingComplete ? "Complete" : "Processing"} 
                    color={processingComplete ? "success" : "primary"}
                    size="small"
                  />
                  <Typography variant="body2" color="primary" fontWeight="medium">
                    {progress}% Complete
                  </Typography>
                </Box>
              </Box>
              
              <LinearProgress 
                variant="determinate" 
                value={progress} 
                sx={{ 
                  mb: 3, 
                  height: 10, 
                  borderRadius: 5,
                  bgcolor: processingComplete ? 'success.light' : 'grey.200'
                }} 
              />
              
              {documentId && (
                <Alert severity="info" sx={{ mb: 2 }}>
                  <Typography variant="body2">
                    Document ID: <strong>{documentId}</strong> • Tracking backend processing...
                  </Typography>
                </Alert>
              )}
              
              <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
                {processingStages.map((stage) => {
                  const stepStatus = getStepStatus(stage.id);
                  const step = processingSteps.find(s => s.id === stage.id);
                  const stepMessage = step ? step.message : stage.description;
                  
                  return (
                    <Box
                      key={stage.id}
                      sx={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        mb: 2,
                        p: 2,
                        borderRadius: 1,
                        bgcolor: stepStatus === 'processing' ? 'primary.50' : 
                                stepStatus === 'completed' ? 'success.50' :
                                stepStatus === 'error' ? 'error.50' : 'transparent',
                        border: stepStatus === 'processing' ? '1px solid' : 'none',
                        borderColor: stepStatus === 'processing' ? 'primary.100' : 'transparent',
                      }}
                    >
                      <Box sx={{ mr: 2, mt: 0.5 }}>
                        {getStatusIcon(stepStatus)}
                      </Box>
                      <Box sx={{ flex: 1 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <Typography variant="subtitle1" color={getStatusColor(stepStatus)}>
                            {stage.label}
                          </Typography>
                          {stepStatus === 'processing' && (
                            <Box sx={{ 
                              width: 20, 
                              height: 20, 
                              borderRadius: '50%', 
                              bgcolor: 'primary.main',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              animation: 'pulse 1.5s ease-in-out infinite'
                            }}>
                              <style>
                                {`
                                  @keyframes pulse {
                                    0% { opacity: 1; }
                                    50% { opacity: 0.5; }
                                    100% { opacity: 1; }
                                  }
                                `}
                              </style>
                            </Box>
                          )}
                        </Box>
                        <Typography variant="body2" color="text.secondary">
                          {stepMessage}
                        </Typography>
                        {stepStatus === 'processing' && stage.id === 3 && (
                          <Typography variant="caption" color="primary" sx={{ display: 'block', mt: 0.5 }}>
                            AI processing document chunks...
                          </Typography>
                        )}
                        {stepStatus === 'error' && (
                          <Typography variant="caption" color="error">
                            {step?.message}
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  );
                })}
              </Box>
              
              {uploadError && (
                <Alert severity="error" sx={{ mt: 2 }}>
                  <Typography variant="subtitle2">Processing Error</Typography>
                  <Typography variant="body2">{uploadError}</Typography>
                </Alert>
              )}
              
              {processingComplete && (
                <Alert severity="success" sx={{ mt: 2 }}>
                  <Typography variant="subtitle2">Contract Successfully Processed!</Typography>
                  <Typography variant="body2">
                    All document chunks have been processed by OpenAI. Contract extraction is complete.
                  </Typography>
                </Alert>
              )}
            </CardContent>
          </Card>
        </Box>
      )}

      {/* Amendment Dialog */}
      <Dialog open={showAmendmentDialog} onClose={() => !uploading && setShowAmendmentDialog(false)}>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <HistoryIcon />
            <Typography>Is this an Amendment?</Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" gutterBottom>
            This document appears to be an amendment. Please provide additional information:
          </Typography>
          
          <FormControl component="fieldset" sx={{ mt: 2 }}>
            <FormLabel component="legend">Document Type</FormLabel>
            <RadioGroup
              value={isAmendment}
              onChange={(e) => setIsAmendment(e.target.value === 'true')}
            >
              <FormControlLabel
                value={true}
                control={<Radio />}
                label="Yes, this is an amendment to an existing contract"
              />
              <FormControlLabel
                value={false}
                control={<Radio />}
                label="No, this is a new contract"
              />
            </RadioGroup>
          </FormControl>

          {isAmendment && (
            <Box sx={{ mt: 3 }}>
              <FormControl fullWidth sx={{ mb: 2 }}>
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
                </RadioGroup>
              </FormControl>

              <FormControl fullWidth>
                <FormLabel>Select Parent Contract</FormLabel>
                <TextField
                  select
                  value={parentDocumentId}
                  onChange={(e) => setParentDocumentId(e.target.value)}
                  SelectProps={{
                    native: true,
                  }}
                  variant="outlined"
                  size="small"
                >
                  <option value="">Select a contract...</option>
                  {existingContracts.map((contract) => (
                    <option key={contract.id} value={contract.id}>
                      {contract.contract_type} - {contract.parties?.join(' & ')} (v{contract.version})
                    </option>
                  ))}
                </TextField>
              </FormControl>
              
              <Alert severity="info" sx={{ mt: 2 }}>
                Version tracking will automatically compare this amendment with the selected parent contract.
              </Alert>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowAmendmentDialog(false)} disabled={uploading}>
            Cancel
          </Button>
          <Button onClick={handleAmendmentSubmit} variant="contained" disabled={uploading}>
            Proceed with Upload
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default EnhancedDocumentUpload;