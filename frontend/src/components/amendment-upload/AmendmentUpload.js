import React, { useState, useEffect } from 'react';
import { Box, ThemeProvider, Button, Paper, Typography } from '@mui/material';
import { CheckCircleOutlined } from '@mui/icons-material';
import amendmentUploadTheme from './AmendmentUploadTheme';
import UploadStepper from './UploadStepper';
import FileUploadStep from './FileUploadStep';
import ParentContractStep from './ParentContractStep';
import AmendmentConfigStep from './AmendmentConfigStep';
import UploadProgressStep from './UploadProgressStep';
import CompletionDialog from './CompletionDialog';
import { uploadDocumentWithMetadata, getContracts } from '../../services/api';

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
  useEffect(() => {
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

  const handleNext = () => {
    setActiveStep((prevStep) => prevStep + 1);
  };

  const handleBack = () => {
    setActiveStep((prevStep) => prevStep - 1);
  };


  const pollDocumentStatus = async (documentId, fileName, fileIndex, totalFiles) => {
    let attempts = 0;
    const maxAttempts = 120;
    
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
            
            if (!documentId) {
                await new Promise(resolve => setTimeout(resolve, 3000));
                continue;
            }
            
            const response = await fetch(
                `${process.env.REACT_APP_API_URL || 'http://localhost:8000'}/documents/${documentId}/status`
            );
            
            if (response.ok) {
                const statusData = await response.json();
                
                let progress = 10;
                let message = 'Uploading...';
                let status = 'uploading';
                
                if (statusData.status === "processing") {
                    progress = 30 + Math.min(50, (attempts * 0.5));
                    message = `Processing chunks with AI... (Attempt ${attempts})`;
                    status = 'processing';
                    
                    if (attempts % 5 === 0) {
                        const chunkProgress = Math.min(8, Math.floor(attempts / 5));
                        message = `Processing chunk ${chunkProgress}/8 with AI...`;
                    }
                } else if (statusData.status === "completed") {
                    progress = 100;
                    message = 'Processing complete!';
                    status = 'completed';
                    
                    // NEW: Check if amendment was auto-applied
                    if (statusData.amendment_applied) {
                        message = 'Amendment processed and auto-applied to parent contract!';
                    }
                    
                    setProcessingStatus(prev => ({
                        ...prev,
                        [fileIndex]: {
                            fileName,
                            status: 'completed',
                            message: statusData.amendment_applied ? 
                                'Amendment processed and auto-applied!' : 
                                'Amendment processed successfully',
                            progress: 100,
                            amendmentApplied: statusData.amendment_applied || false
                        }
                    }));
                    
                    setCompletedFiles(prev => [...prev, { 
                        fileName, 
                        documentId, 
                        contractId: statusData.contract_id,
                        amendmentApplied: statusData.amendment_applied || false,
                        parentUpdated: statusData.parent_updated || false,
                        newParentVersion: statusData.new_parent_version
                    }]);
                    
                    const newProgress = ((fileIndex + 1) / totalFiles) * 100;
                    setOverallProgress(newProgress);
                    
                    return { 
                        success: true, 
                        documentId, 
                        contractId: statusData.contract_id,
                        amendmentApplied: statusData.amendment_applied || false
                    };
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
                
                setProcessingStatus(prev => ({
                    ...prev,
                    [fileIndex]: {
                        fileName,
                        status,
                        message,
                        progress
                    }
                }));
                
                const fileProgress = (fileIndex / totalFiles) * 100;
                const currentFileProgress = (progress / 100) * (100 / totalFiles);
                setOverallProgress(fileProgress + currentFileProgress);
            }
            
            await new Promise(resolve => setTimeout(resolve, 3000));
            
        } catch (error) {
            console.log(`Polling attempt ${attempts} failed:`, error.message);
            
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

  // const pollDocumentStatus = async (documentId, fileName, fileIndex, totalFiles) => {
  //   let attempts = 0;
  //   const maxAttempts = 120;
    
  //   // Initialize status for this file
  //   setProcessingStatus(prev => ({
  //     ...prev,
  //     [fileIndex]: {
  //       fileName,
  //       status: 'uploading',
  //       message: 'Uploading to server...',
  //       progress: 10
  //     }
  //   }));
    
  //   while (attempts < maxAttempts) {
  //     try {
  //       attempts++;
        
  //       if (!documentId) {
  //         await new Promise(resolve => setTimeout(resolve, 3000));
  //         continue;
  //       }
        
  //       const response = await fetch(
  //         `${process.env.REACT_APP_API_URL || 'http://localhost:8000'}/documents/${documentId}/status`
  //       );
        
  //       if (response.ok) {
  //         const statusData = await response.json();
          
  //         let progress = 10;
  //         let message = 'Uploading...';
  //         let status = 'uploading';
          
  //         if (statusData.status === "processing") {
  //           progress = 30 + Math.min(50, (attempts * 0.5));
  //           message = `Processing chunks with AI... (Attempt ${attempts})`;
  //           status = 'processing';
            
  //           if (attempts % 5 === 0) {
  //             const chunkProgress = Math.min(8, Math.floor(attempts / 5));
  //             message = `Processing chunk ${chunkProgress}/8 with AI...`;
  //           }
  //         } else if (statusData.status === "completed") {
  //           progress = 100;
  //           message = 'Processing complete!';
  //           status = 'completed';
            
  //           setProcessingStatus(prev => ({
  //             ...prev,
  //             [fileIndex]: {
  //               fileName,
  //               status: 'completed',
  //               message: 'Amendment processed successfully',
  //               progress: 100
  //             }
  //           }));
            
  //           setCompletedFiles(prev => [...prev, { 
  //             fileName, 
  //             documentId, 
  //             contractId: statusData.contract_id 
  //           }]);
            
  //           const newProgress = ((fileIndex + 1) / totalFiles) * 100;
  //           setOverallProgress(newProgress);
            
  //           return { success: true, documentId, contractId: statusData.contract_id };
  //         } else if (statusData.status.includes("failed")) {
  //           setProcessingStatus(prev => ({
  //             ...prev,
  //             [fileIndex]: {
  //               fileName,
  //               status: 'error',
  //               message: `Processing failed: ${statusData.status}`,
  //               progress: 0
  //             }
  //           }));
  //           return { success: false, error: statusData.status };
  //         }
          
  //         setProcessingStatus(prev => ({
  //           ...prev,
  //           [fileIndex]: {
  //             fileName,
  //             status,
  //             message,
  //             progress
  //           }
  //         }));
          
  //         const fileProgress = (fileIndex / totalFiles) * 100;
  //         const currentFileProgress = (progress / 100) * (100 / totalFiles);
  //         setOverallProgress(fileProgress + currentFileProgress);
  //       }
        
  //       await new Promise(resolve => setTimeout(resolve, 3000));
        
  //     } catch (error) {
  //       console.log(`Polling attempt ${attempts} failed:`, error.message);
        
  //       setProcessingStatus(prev => ({
  //         ...prev,
  //         [fileIndex]: {
  //           fileName,
  //           status: 'error',
  //           message: `Connection error: ${error.message}`,
  //           progress: 0
  //         }
  //       }));
        
  //       await new Promise(resolve => setTimeout(resolve, 5000));
  //     }
  //   }
    
  //   setProcessingStatus(prev => ({
  //     ...prev,
  //     [fileIndex]: {
  //       fileName,
  //       status: 'error',
  //       message: 'Processing timeout',
  //       progress: 0
  //     }
  //   }));
    
  //   return { success: false, error: 'Timeout' };
  // };

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
          
          const result = await uploadDocumentWithMetadata(file, metadata);
          
          if (result && result.id) {
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
      
      setUploading(false);
      
      if (successfulUploads > 0) {
        setShowCompletionDialog(true);
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
    
    setSelectedFiles([]);
    setParentContract(null);
    setActiveStep(0);
    setProcessingStatus({});
    setCompletedFiles([]);
    setOverallProgress(0);
    
    if (onUploadSuccess && completedFiles.length > 0) {
      onUploadSuccess();
    }
  };

  const handlePreviewComparison = () => {
    console.log('Preview comparison');
  };

  const handleFilesSelected = (acceptedFiles) => {
    setSelectedFiles(acceptedFiles);
    if (acceptedFiles.length > 0) {
      setActiveStep(1);
    }
  };

  const handleRemoveFile = (index) => {
    setSelectedFiles(selectedFiles.filter((_, i) => i !== index));
  };

  return (
    <ThemeProvider theme={amendmentUploadTheme}>
      <Box sx={{ maxWidth: 800, mx: 'auto', mt: 4 }}>
        <Box sx={{ display: 'flex', gap: 4 }}>
          <Box sx={{ flex: 1 }}>
            <UploadStepper activeStep={activeStep} uploading={uploading} />
          </Box>
          
          <Box sx={{ flex: 2 }}>
            {activeStep === 0 && (
              <FileUploadStep
                selectedFiles={selectedFiles}
                onFilesSelected={handleFilesSelected}
                onRemoveFile={handleRemoveFile}
                disabled={uploading}
              />
            )}

            {activeStep === 1 && (
              <ParentContractStep
                parentContract={parentContract}
                onSelectContract={setParentContract}
                existingContracts={existingContracts}
                disabled={uploading}
              />
            )}

            {activeStep === 2 && (
              <AmendmentConfigStep
                amendmentType={amendmentType}
                onChangeAmendmentType={setAmendmentType}
                disabled={uploading}
              />
            )}

            {activeStep === 3 && (
              <UploadProgressStep
                selectedFiles={selectedFiles}
                parentContract={parentContract}
                amendmentType={amendmentType}
                uploading={uploading}
                processingStatus={processingStatus}
                overallProgress={overallProgress}
                onUpload={handleUpload}
                onPreviewComparison={handlePreviewComparison}
                disabled={uploading}
              />
            )}

            <Box sx={{ mt: 3, display: 'flex', gap: 1 }}>
              <Button
                disabled={activeStep === 0 || uploading}
                onClick={handleBack}
                sx={{ minWidth: 100 }}
              >
                Back
              </Button>
              <Button
                variant="contained"
                onClick={handleNext}
                disabled={
                  (activeStep === 0 && selectedFiles.length === 0) ||
                  (activeStep === 1 && !parentContract) ||
                  activeStep === 3 ||
                  uploading
                }
                sx={{ minWidth: 100 }}
              >
                {activeStep === 3 ? 'Finish' : 'Next'}
              </Button>
            </Box>
          </Box>
        </Box>

        {activeStep === 4 && !uploading && (
          <Paper sx={{ p: 4, mt: 4, textAlign: 'center' }}>
            <CheckCircleOutlined sx={{ fontSize: 48, color: 'success.main', mb: 2 }} />
            <Typography variant="h6" gutterBottom fontWeight={600}>
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
              sx={{ minWidth: 200 }}
            >
              Upload More Amendments
            </Button>
          </Paper>
        )}

        <CompletionDialog
          open={showCompletionDialog}
          onClose={() => setShowCompletionDialog(false)}
          onCompleteAndRedirect={handleCompleteAndRedirect}
          completedFiles={completedFiles}
          processingStatus={processingStatus}
          selectedFiles={selectedFiles}
        />
      </Box>
    </ThemeProvider>
  );
};

export default AmendmentUpload;