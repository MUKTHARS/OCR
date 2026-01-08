import React from 'react';
import {
  Box,
  Paper,
  Typography,
  Chip,
  LinearProgress,
} from '@mui/material';
import { getStatusIcon, getStatusColor } from './AmendmentUtils';

const ProcessingStatus = ({ 
  fileName, 
  status, 
  message, 
  progress 
}) => {
  const statusInfo = getStatusIcon(status);
  const statusColor = getStatusColor(status);

  return (
    <Paper
      sx={{
        p: 2,
        mb: 1.5,
        border: '1px solid',
        borderColor: `${statusColor}.light`,
        bgcolor: `${statusColor}.50`,
        transition: 'all 0.2s ease',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
        <Box sx={{ 
          width: 24,
          height: 24,
          borderRadius: '50%',
          bgcolor: `${statusColor}.main`,
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '0.875rem',
          fontWeight: 600,
          mr: 1.5,
        }}>
          {statusInfo.icon}
        </Box>
        
        <Typography variant="body2" sx={{ flex: 1, fontWeight: 500 }}>
          {fileName}
        </Typography>
        
        <Chip
          label={status.toUpperCase()}
          size="small"
          color={statusColor}
          sx={{ fontWeight: 500 }}
        />
      </Box>
      
      <Typography variant="caption" color="text.secondary">
        {message}
      </Typography>
      
      {status === 'processing' && (
        <LinearProgress 
          variant="determinate" 
          value={progress} 
          sx={{ 
            mt: 1.5, 
            height: 4, 
            borderRadius: 2,
            bgcolor: `${statusColor}.light`,
            '& .MuiLinearProgress-bar': {
              bgcolor: `${statusColor}.main`,
            }
          }} 
        />
      )}
    </Paper>
  );
};

export default ProcessingStatus;