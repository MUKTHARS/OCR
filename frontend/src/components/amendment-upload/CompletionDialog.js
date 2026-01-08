import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Paper,
  Alert,
  Chip,
} from '@mui/material';
import {
  CheckCircleOutlined,
  ErrorOutline,
} from '@mui/icons-material';

const CompletionDialog = ({
  open,
  onClose,
  onCompleteAndRedirect,
  completedFiles = [],
  processingStatus = {},
  selectedFiles = [],
}) => {
  const successCount = completedFiles.length;
  const totalCount = selectedFiles.length;
  const errorFiles = Object.values(processingStatus).filter(s => s.status === 'error');

  return (
    <Dialog
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: { borderRadius: 2 }
      }}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CheckCircleOutlined color="success" />
          <Typography variant="h6">Amendment Processing Complete</Typography>
        </Box>
      </DialogTitle>
      
      <DialogContent>
        <Typography variant="body1" gutterBottom>
          {successCount} out of {totalCount} amendment{totalCount !== 1 ? 's' : ''} processed successfully.
        </Typography>
        
        <Box sx={{ mt: 2, mb: 2 }}>
          {/* Successful files */}
          {completedFiles.map((file, idx) => (
            <Paper 
              key={idx} 
              sx={{ 
                p: 1.5, 
                mb: 1, 
                bgcolor: 'success.50',
                border: '1px solid',
                borderColor: 'success.light',
                borderRadius: 2,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CheckCircleOutlined fontSize="small" color="success" />
                <Typography variant="body2" sx={{ flex: 1 }}>
                  {file.fileName}
                </Typography>
                <Chip 
                  label="Success" 
                  size="small" 
                  color="success"
                  sx={{ fontWeight: 500 }}
                />
              </Box>
            </Paper>
          ))}
          
          {/* Error files */}
          {errorFiles.map((file, idx) => (
            <Paper 
              key={idx} 
              sx={{ 
                p: 1.5, 
                mb: 1, 
                bgcolor: 'error.50',
                border: '1px solid',
                borderColor: 'error.light',
                borderRadius: 2,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <ErrorOutline fontSize="small" color="error" />
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body2">
                    {file.fileName}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {file.message}
                  </Typography>
                </Box>
                <Chip 
                  label="Error" 
                  size="small" 
                  color="error"
                  sx={{ fontWeight: 500 }}
                />
              </Box>
            </Paper>
          ))}
        </Box>
        
        <Alert severity="info">
          <Typography variant="body2">
            All document chunks have been processed by AI. You can now view and compare the amendments.
          </Typography>
        </Alert>
      </DialogContent>
      
      <DialogActions sx={{ p: 2, borderTop: '1px solid', borderColor: 'divider' }}>
        <Button onClick={onClose}>
          Stay Here
        </Button>
        <Button 
          variant="contained" 
          onClick={onCompleteAndRedirect}
          disabled={completedFiles.length === 0}
        >
          View Amendments
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CompletionDialog;