import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Box, Button, Typography, LinearProgress } from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import { uploadDocument } from '../services/api';

const DocumentUpload = ({ onUploadSuccess }) => {
  const [uploading, setUploading] = React.useState(false);
  const [progress, setProgress] = React.useState(0);

const onDrop = useCallback(async (acceptedFiles) => {
  console.log('File dropped:', acceptedFiles);
  if (acceptedFiles.length > 0) {
    setUploading(true);
    setProgress(30);
    
    try {
      const file = acceptedFiles[0];
      console.log('Uploading file:', file.name, 'size:', file.size, 'type:', file.type);
      
      const result = await uploadDocument(file);
      console.log('Upload successful:', result);
      setProgress(100);
      
      setTimeout(() => {
        setUploading(false);
        setProgress(0);
        if (onUploadSuccess) {
          onUploadSuccess(result);
        }
      }, 1000);
      
    } catch (error) {
      console.error('Upload failed:', error);
      console.error('Error details:', error.response?.data || error.message);
      setUploading(false);
      setProgress(0);
      alert(`Upload failed: ${error.message}`);
    }
  }
}, [onUploadSuccess]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc', '.docx'],
    },
    maxFiles: 1,
  });

  return (
    <Box sx={{ width: '100%', maxWidth: 600, mx: 'auto', mt: 4 }}>
      <Box
        {...getRootProps()}
        sx={{
          border: '2px dashed',
          borderColor: isDragActive ? 'primary.main' : 'grey.400',
          borderRadius: 2,
          p: 4,
          textAlign: 'center',
          cursor: 'pointer',
          bgcolor: isDragActive ? 'action.hover' : 'background.paper',
          '&:hover': {
            bgcolor: 'action.hover',
          },
        }}
      >
        <input {...getInputProps()} />
        <CloudUploadIcon sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
        <Typography variant="h6" gutterBottom>
          {isDragActive ? 'Drop contract here' : 'Drag & drop contract file'}
        </Typography>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          Supports PDF and Word documents
        </Typography>
        <Button variant="contained" sx={{ mt: 2 }}>
          Browse Files
        </Button>
      </Box>

      {uploading && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="body2" gutterBottom>
            Processing contract...
          </Typography>
          <LinearProgress variant="determinate" value={progress} sx={{ mt: 1 }} />
        </Box>
      )}
    </Box>
  );
};

export default DocumentUpload;