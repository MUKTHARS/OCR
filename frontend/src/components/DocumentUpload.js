import React, { useCallback, useState } from 'react';
import { 
  useDropzone 
} from 'react-dropzone';
import {
  Box,
  Button,
  Typography,
  LinearProgress,
  Card,
  CardContent,
  Alert,
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import { uploadDocument } from '../services/api';

const DocumentUpload = ({ onUploadSuccess }) => {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploadCompleted, setUploadCompleted] = useState(false);

  const onDrop = useCallback(async (acceptedFiles) => {
    console.log('File dropped:', acceptedFiles);
    if (acceptedFiles.length > 0 && !uploading) {
      setUploading(true);
      setUploadCompleted(false);
      setProgress(30);
      
      try {
        const file = acceptedFiles[0];
        console.log('Uploading file:', file.name, 'size:', file.size, 'type:', file.type);
        
        setProgress(50);
        const result = await uploadDocument(file);
        console.log('Upload successful:', result);
        
        setProgress(100);
        setUploadCompleted(true);
        
        // Wait to show completion message, then call success callback
        setTimeout(() => {
          setUploading(false);
          setProgress(0);
          if (onUploadSuccess) {
            onUploadSuccess(result);
          }
        }, 2000);
        
      } catch (error) {
        console.error('Upload failed:', error);
        setUploading(false);
        setProgress(0);
        alert(`Upload failed: ${error.message}`);
      }
    }
  }, [onUploadSuccess, uploading]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc', '.docx'],
    },
    maxFiles: 1,
    disabled: uploading,
  });

  return (
    <Box sx={{ width: '100%', maxWidth: 600, mx: 'auto', mt: 4 }}>
      <Box
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
        <CloudUploadIcon sx={{ 
          fontSize: 48, 
          color: uploading ? 'grey.400' : 'primary.main', 
          mb: 2 
        }} />
        <Typography variant="h6" gutterBottom color={uploading ? 'text.disabled' : 'text.primary'}>
          {uploading ? 'Processing...' : (isDragActive ? 'Drop contract here' : 'Drag & drop contract file')}
        </Typography>
        <Typography variant="body2" color={uploading ? 'text.disabled' : 'text.secondary'} gutterBottom>
          {uploading ? 'Please wait while we upload and process your document' : 'Supports PDF and Word documents'}
        </Typography>
        {!uploading && (
          <Button variant="contained" sx={{ mt: 2 }}>
            Browse Files
          </Button>
        )}
      </Box>

      {/* Processing Status */}
      {uploading && (
        <Card sx={{ mt: 3 }}>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="subtitle1" fontWeight="medium">
                {uploadCompleted ? 'Processing Complete!' : 'Processing Contract...'}
              </Typography>
              <Typography variant="body2" color="primary">
                {progress}% Complete
              </Typography>
            </Box>
            
            <LinearProgress 
              variant="determinate" 
              value={progress} 
              sx={{ 
                mb: 2, 
                height: 8, 
                borderRadius: 4,
                bgcolor: uploadCompleted ? 'success.light' : 'grey.200'
              }} 
            />
            
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 2 }}>
              {uploadCompleted ? (
                <>
                  <CheckCircleIcon color="success" />
                  <Typography variant="body2" color="success.main">
                    Contract processed successfully! Redirecting...
                  </Typography>
                </>
              ) : (
                <>
                  <HourglassEmptyIcon color="primary" />
                  <Typography variant="body2" color="text.secondary">
                    Extracting text, analyzing clauses, and calculating risk...
                  </Typography>
                </>
              )}
            </Box>
            
            {!uploadCompleted && (
              <Alert severity="info" sx={{ mt: 2 }}>
                Please wait while we process your contract. This may take a few moments.
              </Alert>
            )}
          </CardContent>
        </Card>
      )}
    </Box>
  );
};

export default DocumentUpload;