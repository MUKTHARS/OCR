import React, { useState } from 'react';
import { Box, ThemeProvider, Card, CardContent, Typography, Alert, Chip } from '@mui/material';
import UploadTheme from './UploadTheme';
import UploadZone from './UploadZone';
import UploadProgress from './UploadProgress';
import ProcessingSteps from './ProcessingSteps';
import AmendmentDialog from './AmendmentDialog';
import { uploadDocumentWithMetadata } from '../../services/api';
import { processingStages, fileTypes } from './UploadUtils';

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
        
        const response = await fetch(
          `${process.env.REACT_APP_API_URL || 'http://localhost:8000'}/documents/${documentId}/status`
        );
        
        if (response.ok) {
          const statusData = await response.json();
          
          const baseProgress = 30;
          const incrementalProgress = Math.min(60, (attempts * 0.5));
          const pollProgress = baseProgress + incrementalProgress;
          setProgress(pollProgress);
          
          if (statusData.status === "processing") {
            updateProcessingStep(3, 'processing', `Processing chunks with AI...`);
            
            if (attempts % 5 === 0) {
              const chunkNumber = Math.min(5, Math.floor(attempts / 10));
              updateProcessingStep(3, 'processing', `Processing chunk ${chunkNumber}/5 with AI...`);
            }
            
            await new Promise(resolve => setTimeout(resolve, 3000));
            continue;
          }
          else if (statusData.status === "completed") {
            updateProcessingStep(3, 'completed', 'All chunks processed successfully');
            updateProcessingStep(4, 'completed', 'AI analysis complete');
            updateProcessingStep(5, 'completed', 'Clauses extracted');
            updateProcessingStep(6, 'completed', 'Risk assessment complete');
            updateProcessingStep(7, 'completed', 'Embeddings created');
            updateProcessingStep(8, 'completed', 'Data saved to database');
            updateProcessingStep(9, 'processing', 'Final verification...');
            setProgress(95);
            
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
            updateProcessingStep(10, 'error', `Processing failed: ${statusData.status}`);
            setUploadError(`Document processing failed: ${statusData.status}`);
            return {
              success: false,
              error: statusData.status
            };
          }
        }
        
        await new Promise(resolve => setTimeout(resolve, 3000));
        
      } catch (error) {
        console.log(`Polling attempt ${attempts} failed:`, error.message);
        
        if (attempts < 10) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        } else {
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      }
    }
    
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
      updateProcessingStep(1, 'processing', 'Starting upload...');
      setProgress(10);
      
      const metadata = {
        is_amendment: isAmendmentFlag,
        parent_document_id: isAmendmentFlag ? parseInt(parentDocumentId) : null,
        amendment_type: isAmendmentFlag ? amendmentType : null,
      };
      
      updateProcessingStep(1, 'completed', 'File uploaded successfully');
      updateProcessingStep(2, 'processing', 'Extracting text from document...');
      setProgress(20);
      
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      updateProcessingStep(2, 'completed', 'Text extracted');
      updateProcessingStep(3, 'processing', 'Starting chunk processing with AI...');
      setProgress(30);
      
      const result = await uploadDocumentWithMetadata(file, metadata);
      
      if (!result || !result.id) {
        throw new Error('No document ID returned from server');
      }
      
      setDocumentId(result.id);
      
      updateProcessingStep(3, 'processing', 'Backend processing started. Waiting for completion...');
      setProgress(40);
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const pollResult = await pollDocumentStatus(result.id);
      
      if (pollResult.success) {
        setUploadCompleted(true);
        
        setTimeout(() => {
          setUploading(false);
          
          if (onUploadSuccess) {
            onUploadSuccess({
              ...result,
              contractId: pollResult.contractId,
              message: pollResult.message
            });
          }
          
          setTimeout(() => {
            resetUploadState();
          }, 1000);
        }, 2000);
        
      } else {
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

  return (
    <ThemeProvider theme={UploadTheme}>
      <Box sx={{ width: '100%', maxWidth: 800, mx: 'auto', mt: 4 }}>
        <UploadZone
          onDrop={onDrop}
          disabled={uploading}
          accept={{
            'application/pdf': ['.pdf'],
          }}
          maxFiles={1}
          title="Upload Contract Document"
          subtitle="Drag & drop or click to browse"
          acceptedTypes="Supports PDF documents"
        />

        {uploading && (
          <Box sx={{ mt: 4 }}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6" fontWeight={600}>
                    {processingComplete ? 'Processing Complete!' : 'Processing Contract...'}
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Chip 
                      label={processingComplete ? "Complete" : "Processing"} 
                      color={processingComplete ? "success" : "primary"}
                      size="small"
                      sx={{ fontWeight: 500 }}
                    />
                    <Typography variant="body2" color="primary" fontWeight={600}>
                      {progress}%
                    </Typography>
                  </Box>
                </Box>
                
                <UploadProgress
                  progress={progress}
                  completed={uploadCompleted}
                  uploading={uploading}
                  documentId={documentId}
                  showDocumentId={true}
                />
                
                {documentId && (
                  <Alert severity="info" sx={{ mb: 2 }}>
                    <Typography variant="body2">
                      Document ID: <Box component="span" fontWeight={600}>{documentId}</Box> • Tracking backend processing...
                    </Typography>
                  </Alert>
                )}
                
                <ProcessingSteps
                  stages={processingStages}
                  processingSteps={processingSteps}
                  currentStep={currentStep}
                  showPulse={true}
                />
                
                {uploadError && (
                  <Alert severity="error" sx={{ mt: 2 }}>
                    <Typography variant="subtitle2" fontWeight={600}>Processing Error</Typography>
                    <Typography variant="body2">{uploadError}</Typography>
                  </Alert>
                )}
                
                {processingComplete && (
                  <Alert severity="success" sx={{ mt: 2 }}>
                    <Typography variant="subtitle2" fontWeight={600}>Contract Successfully Processed!</Typography>
                    <Typography variant="body2">
                      All document chunks have been processed by AI. Contract extraction is complete.
                    </Typography>
                  </Alert>
                )}
              </CardContent>
            </Card>
          </Box>
        )}

        <AmendmentDialog
          open={showAmendmentDialog}
          onClose={() => setShowAmendmentDialog(false)}
          onSubmit={handleAmendmentSubmit}
          isAmendment={isAmendment}
          setIsAmendment={setIsAmendment}
          parentDocumentId={parentDocumentId}
          setParentDocumentId={setParentDocumentId}
          amendmentType={amendmentType}
          setAmendmentType={setAmendmentType}
          existingContracts={existingContracts}
          uploading={uploading}
        />
      </Box>
    </ThemeProvider>
  );
};


export default EnhancedDocumentUpload;