import React from 'react';
import {
  Card,
  CardContent,
  Box,
  Typography,
  LinearProgress,
  Alert,
} from '@mui/material';
import {
  CheckCircleOutlined,
  HourglassEmptyOutlined,
} from '@mui/icons-material';

const UploadProgress = ({ 
  progress = 0, 
  completed = false, 
  uploading = false,
  documentId = null,
  showDocumentId = false,
}) => {
  return (
    <Card sx={{ mt: 3 }}>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" fontWeight={600}>
            {completed ? 'Processing Complete!' : 'Processing Contract...'}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2" color="primary" fontWeight={600}>
              {progress}%
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Complete
            </Typography>
          </Box>
        </Box>
        
        <LinearProgress 
          variant="determinate" 
          value={progress} 
          sx={{ 
            mb: 2, 
            height: 8, 
            borderRadius: 4,
            bgcolor: completed ? 'success.light' : 'grey.200'
          }} 
        />
        
        {showDocumentId && documentId && (
          <Alert severity="info" sx={{ mb: 2 }}>
            <Typography variant="body2">
              Document ID: <Box component="span" fontWeight={600}>{documentId}</Box>
            </Typography>
          </Alert>
        )}
        
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 2 }}>
          {completed ? (
            <>
              <CheckCircleOutlined color="success" />
              <Typography variant="body2" color="success.main" fontWeight={500}>
                Contract processed successfully! Redirecting...
              </Typography>
            </>
          ) : (
            <>
              <HourglassEmptyOutlined color="primary" />
              <Typography variant="body2" color="text.secondary">
                Extracting text, analyzing clauses, and calculating risk...
              </Typography>
            </>
          )}
        </Box>
        
        {!completed && uploading && (
          <Alert severity="info" sx={{ mt: 2 }}>
            <Typography variant="body2">
              Please wait while we process your contract. This may take a few moments.
            </Typography>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};

export default UploadProgress;