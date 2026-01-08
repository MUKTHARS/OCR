import React from 'react';
import {
  Paper,
  Box,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  IconButton,
} from '@mui/material';
import {
  CloudUploadOutlined,
  DescriptionOutlined,
  CloseOutlined,
} from '@mui/icons-material';
import { useDropzone } from 'react-dropzone';
import { formatFileSize } from './AmendmentUtils';

const FileUploadStep = ({ 
  selectedFiles, 
  onFilesSelected, 
  onRemoveFile,
  disabled = false 
}) => {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: onFilesSelected,
    accept: {
      'application/pdf': ['.pdf'],
    },
    multiple: true,
    disabled,
  });

  return (
    <Box>
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
          fontSize: 48, 
          color: disabled ? 'grey.400' : 'primary.main', 
          mb: 2 
        }} />
        <Typography variant="h6" gutterBottom color={disabled ? 'text.disabled' : 'text.primary'}>
          {isDragActive ? 'Drop amendment files here' : 'Drag & drop amendment files'}
        </Typography>
        <Typography variant="body2" color={disabled ? 'text.disabled' : 'text.secondary'} gutterBottom>
          Supports PDF documents. You can select multiple files.
        </Typography>
        <Button 
          variant="contained" 
          sx={{ mt: 2 }}
          disabled={disabled}
        >
          Browse Folder
        </Button>
      </Paper>

      {selectedFiles.length > 0 && (
        <Box sx={{ mt: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="subtitle2" fontWeight={600}>
              Selected Files ({selectedFiles.length})
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Total: {formatFileSize(selectedFiles.reduce((acc, file) => acc + file.size, 0))}
            </Typography>
          </Box>
          
          <Grid container spacing={1}>
            {selectedFiles.map((file, idx) => (
              <Grid item xs={12} key={idx}>
                <Card variant="outlined">
                  <CardContent sx={{ py: 1.5, px: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Box sx={{ 
                        p: 1, 
                        borderRadius: 2,
                        bgcolor: 'primary.50',
                        color: 'primary.main',
                      }}>
                        <DescriptionOutlined fontSize="small" />
                      </Box>
                      
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="body2" fontWeight={500} noWrap>
                          {file.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {formatFileSize(file.size)}
                        </Typography>
                      </Box>
                      
                      <IconButton
                        size="small"
                        onClick={() => onRemoveFile(idx)}
                        disabled={disabled}
                        sx={{ 
                          color: 'grey.600',
                          '&:hover': {
                            color: 'error.main',
                          }
                        }}
                      >
                        <CloseOutlined fontSize="small" />
                      </IconButton>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>
      )}
    </Box>
  );
};

export default FileUploadStep;