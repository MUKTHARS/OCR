import React from 'react';
import {
  Card,
  CardContent,
  Box,
  Typography,
  LinearProgress,
  Alert,
  Button,
} from '@mui/material';
import {
  CloudUploadOutlined,
  CompareArrowsOutlined,
  WarningAmberOutlined,
} from '@mui/icons-material';
import ProcessingStatus from './ProcessingStatus';

const UploadProgressStep = ({
  selectedFiles = [],
  parentContract,
  amendmentType,
  uploading,
  processingStatus = {},
  overallProgress,
  onUpload,
  onPreviewComparison,
  disabled = false,
}) => {
  const hasErrors = Object.values(processingStatus).some(s => s.status === 'error');

  return (
    <Box>
      {uploading && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6" fontWeight={600}>
                Processing Amendments
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="body2" color="primary" fontWeight={600}>
                  {Math.round(overallProgress)}%
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Complete
                </Typography>
              </Box>
            </Box>
            
            <LinearProgress 
              variant="determinate" 
              value={overallProgress} 
              sx={{ 
                mb: 3, 
                height: 8, 
                borderRadius: 4,
              }} 
            />
            
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Processing {selectedFiles.length} amendment file{selectedFiles.length !== 1 ? 's' : ''} as {amendmentType} to:
              <br />
              <Box component="span" fontWeight={600}>
                {parentContract?.contract_type} (v{parentContract?.version})
              </Box>
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
                  <ProcessingStatus
                    key={idx}
                    fileName={fileStatus.fileName}
                    status={fileStatus.status}
                    message={fileStatus.message}
                    progress={fileStatus.progress}
                  />
                );
              })}
            </Box>
            
            {hasErrors && (
              <Alert 
                severity="warning" 
                icon={<WarningAmberOutlined />}
                sx={{ mt: 2 }}
              >
                <Typography variant="body2">
                  Some amendments failed to process. You can still view the successful ones.
                </Typography>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}
      
      <Alert 
        severity={uploading ? "warning" : "info"}
        icon={uploading ? <WarningAmberOutlined /> : <CloudUploadOutlined />}
        sx={{ mb: 3 }}
      >
        <Typography variant="subtitle2" fontWeight={600} gutterBottom>
          {uploading ? 'Processing in Progress' : 'Ready to Upload'}
        </Typography>
        <Typography variant="body2">
          {uploading 
            ? 'Please wait for all chunks to be processed by AI before navigating away.'
            : `You are about to upload ${selectedFiles.length} amendment file${selectedFiles.length !== 1 ? 's' : ''} as ${amendmentType} to:`}
        </Typography>
        {!uploading && parentContract && (
          <Typography variant="body2" fontWeight={600} sx={{ mt: 0.5 }}>
            {parentContract.contract_type} (v{parentContract.version})
          </Typography>
        )}
      </Alert>

      <Box sx={{ display: 'flex', gap: 2 }}>
        <Button
          variant="contained"
          onClick={onUpload}
          disabled={uploading || disabled || !selectedFiles.length || !parentContract}
          startIcon={<CloudUploadOutlined />}
          sx={{ flex: 1 }}
        >
          {uploading ? 'Processing...' : 'Upload Amendments'}
        </Button>
        
        <Button
          variant="outlined"
          onClick={onPreviewComparison}
          disabled={uploading || disabled}
          startIcon={<CompareArrowsOutlined />}
        >
          Preview Comparison
        </Button>
      </Box>
    </Box>
  );
};

export default UploadProgressStep;