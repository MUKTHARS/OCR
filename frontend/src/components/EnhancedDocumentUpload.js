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
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import HistoryIcon from '@mui/icons-material/History';
import { useDropzone } from 'react-dropzone';
import { uploadDocumentWithMetadata } from '../services/api';

const EnhancedDocumentUpload = ({ onUploadSuccess, existingContracts = [] }) => {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isAmendment, setIsAmendment] = useState(false);
  const [parentDocumentId, setParentDocumentId] = useState('');
  const [amendmentType, setAmendmentType] = useState('modification');
  const [showAmendmentDialog, setShowAmendmentDialog] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);

  const onDrop = async (acceptedFiles) => {
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
        startUpload(file, false);
      }
    }
  };

  const startUpload = async (file, isAmendmentFlag) => {
    setUploading(true);
    setProgress(30);
    
    try {
      const metadata = {
        is_amendment: isAmendmentFlag,
        parent_document_id: isAmendmentFlag ? parseInt(parentDocumentId) : null,
        amendment_type: isAmendmentFlag ? amendmentType : null,
      };
      
      const result = await uploadDocumentWithMetadata(file, metadata);
      setProgress(100);
      
      setTimeout(() => {
        setUploading(false);
        setProgress(0);
        setSelectedFile(null);
        setParentDocumentId('');
        setIsAmendment(false);
        
        if (onUploadSuccess) {
          onUploadSuccess(result);
        }
      }, 1000);
      
    } catch (error) {
      console.error('Upload failed:', error);
      setUploading(false);
      setProgress(0);
      alert(`Upload failed: ${error.message}`);
    }
  };

  const handleAmendmentSubmit = () => {
    if (isAmendment && !parentDocumentId) {
      alert('Please select a parent contract for the amendment');
      return;
    }
    
    startUpload(selectedFile, isAmendment);
    setShowAmendmentDialog(false);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
    },
    maxFiles: 1,
  });

  return (
    <Box sx={{ width: '100%', maxWidth: 800, mx: 'auto', mt: 4 }}>
      {/* Upload Zone */}
      <Paper
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
        <CloudUploadIcon sx={{ fontSize: 64, color: 'primary.main', mb: 2 }} />
        <Typography variant="h5" gutterBottom>
          {isDragActive ? 'Drop contract here' : 'Upload Contract Document'}
        </Typography>
        <Typography variant="body1" color="text.secondary" gutterBottom>
          Drag & drop or click to browse. Supports PDF documents.
        </Typography>
        <Alert severity="info" sx={{ mt: 2, textAlign: 'left' }}>
          <strong>Enterprise Features:</strong> Automatic amendment detection, version tracking, 
          detailed extraction of financial terms, risk analysis, and compliance monitoring.
        </Alert>
      </Paper>

      {/* Progress */}
      {uploading && (
        <Box sx={{ mt: 3 }}>
          <Typography variant="body2" gutterBottom>
            Processing contract...
          </Typography>
          <LinearProgress variant="determinate" value={progress} sx={{ mt: 1 }} />
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            Extracting detailed information, analyzing risks, and creating embeddings...
          </Typography>
        </Box>
      )}

      {/* Amendment Dialog */}
      <Dialog open={showAmendmentDialog} onClose={() => setShowAmendmentDialog(false)}>
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
          <Button onClick={() => setShowAmendmentDialog(false)}>Cancel</Button>
          <Button onClick={handleAmendmentSubmit} variant="contained">
            Proceed with Upload
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default EnhancedDocumentUpload;