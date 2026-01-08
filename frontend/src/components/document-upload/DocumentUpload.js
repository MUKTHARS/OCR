import React, { useState, useCallback } from 'react';
import { Box, ThemeProvider, Alert } from '@mui/material';
import UploadTheme from './UploadTheme';
import UploadZone from './UploadZone';
import UploadProgress from './UploadProgress';
import { uploadDocument } from '../services/api';
import { fileTypes } from './UploadUtils';

const DocumentUpload = ({ onUploadSuccess }) => {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploadCompleted, setUploadCompleted] = useState(false);

  const onDrop = useCallback(async (acceptedFiles) => {
    if (acceptedFiles.length > 0 && !uploading) {
      setUploading(true);
      setUploadCompleted(false);
      setProgress(30);
      
      try {
        const file = acceptedFiles[0];
        setProgress(50);
        
        const result = await uploadDocument(file);
        
        setProgress(100);
        setUploadCompleted(true);
        
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

  return (
    <ThemeProvider theme={UploadTheme}>
      <Box sx={{ width: '100%', maxWidth: 600, mx: 'auto', mt: 4 }}>
        <UploadZone
          onDrop={onDrop}
          disabled={uploading}
          accept={{
            'application/pdf': ['.pdf'],
            'application/msword': ['.doc', '.docx'],
          }}
          maxFiles={1}
          title="Upload Contract Document"
          subtitle="Drag & drop or click to browse"
          acceptedTypes="Supports PDF and Word documents"
        />

        {uploading && (
          <UploadProgress
            progress={progress}
            completed={uploadCompleted}
            uploading={uploading}
            showDocumentId={false}
          />
        )}
      </Box>
    </ThemeProvider>
  );
};

export default DocumentUpload;