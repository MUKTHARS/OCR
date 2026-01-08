import React from 'react';
import {
  Paper,
  Box,
  Typography,
  Button,
} from '@mui/material';
import CloudUploadOutlined from '@mui/icons-material/CloudUploadOutlined';
import { useDropzone } from 'react-dropzone';

const UploadZone = ({ 
  onDrop, 
  disabled = false, 
  accept = {}, 
  maxFiles = 1,
  title = 'Upload Contract Document',
  subtitle = 'Drag & drop or click to browse',
  acceptedTypes = 'Supports PDF documents'
}) => {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept,
    maxFiles,
    disabled,
  });

  return (
    <Paper
      {...getRootProps()}
      sx={{
        border: '2px dashed',
        borderColor: disabled ? 'grey.300' : (isDragActive ? 'primary.main' : 'grey.300'),
        borderRadius: 2,
        p: 4,
        textAlign: 'center',
        cursor: disabled ? 'not-allowed' : 'pointer',
        bgcolor: disabled ? 'grey.50' : (isDragActive ? 'primary.50' : 'transparent'),
        opacity: disabled ? 0.7 : 1,
        transition: 'all 0.2s ease',
        '&:hover': !disabled && {
          borderColor: 'primary.main',
          bgcolor: 'primary.50',
        },
      }}
    >
      <input {...getInputProps()} />
      <CloudUploadOutlined sx={{ 
        fontSize: 64, 
        color: disabled ? 'grey.400' : 'primary.main', 
        mb: 2 
      }} />
      <Typography variant="h5" gutterBottom color={disabled ? 'text.disabled' : 'text.primary'}>
        {disabled ? 'Processing...' : (isDragActive ? 'Drop contract here' : title)}
      </Typography>
      <Typography variant="body1" color={disabled ? 'text.disabled' : 'text.secondary'} gutterBottom>
        {disabled ? 'Please wait while we process your document' : `${subtitle}. ${acceptedTypes}`}
      </Typography>
      {!disabled && (
        <Button 
          variant="contained" 
          sx={{ mt: 2 }}
        >
          Browse Files
        </Button>
      )}
    </Paper>
  );
};

export default UploadZone;