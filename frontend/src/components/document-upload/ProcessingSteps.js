import React from 'react';
import {
  Box,
  Typography,
  Chip,
} from '@mui/material';
import {
  CheckCircleOutlined,
  HourglassEmptyOutlined,
  ErrorOutline,
  CloudUploadOutlined,
} from '@mui/icons-material';
import { getStatusColor } from './UploadUtils';

const ProcessingSteps = ({ 
  stages = [], 
  processingSteps = [], 
  currentStep = -1,
  showPulse = false 
}) => {
  const getStepStatus = (stageId) => {
    const step = processingSteps.find(s => s.id === stageId);
    return step ? step.status : 'pending';
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return <CheckCircleOutlined fontSize="small" color="success" />;
      case 'processing':
        return <HourglassEmptyOutlined fontSize="small" color="primary" />;
      case 'error':
        return <ErrorOutline fontSize="small" color="error" />;
      case 'uploading':
        return <CloudUploadOutlined fontSize="small" color="info" />;
      default:
        return <HourglassEmptyOutlined fontSize="small" color="disabled" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'processing':
        return 'primary';
      case 'error':
        return 'error';
      case 'uploading':
        return 'info';
      default:
        return 'default';
    }
  };

  return (
    <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
      {stages.map((stage) => {
        const stepStatus = getStepStatus(stage.id);
        const step = processingSteps.find(s => s.id === stage.id);
        const stepMessage = step ? step.message : stage.description;
        const statusColor = getStatusColor(stepStatus);
        
        return (
          <Box
            key={stage.id}
            sx={{
              display: 'flex',
              alignItems: 'flex-start',
              mb: 2,
              p: 2,
              borderRadius: 1,
              bgcolor: stepStatus === 'processing' ? 'primary.50' : 
                      stepStatus === 'completed' ? 'success.50' :
                      stepStatus === 'error' ? 'error.50' : 'transparent',
              border: '1px solid',
              borderColor: stepStatus === 'processing' ? 'primary.100' : 
                          stepStatus === 'completed' ? 'success.100' :
                          stepStatus === 'error' ? 'error.100' : 'transparent',
            }}
          >
            <Box sx={{ mr: 2, mt: 0.5 }}>
              {getStatusIcon(stepStatus)}
            </Box>
            <Box sx={{ flex: 1 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Typography variant="subtitle2" fontWeight={600}>
                  {stage.label}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {stepStatus === 'processing' && showPulse && (
                    <Box sx={{ 
                      width: 16, 
                      height: 16, 
                      borderRadius: '50%', 
                      bgcolor: 'primary.main',
                      animation: 'pulse 1.5s ease-in-out infinite'
                    }}>
                      <style>
                        {`
                          @keyframes pulse {
                            0% { opacity: 1; }
                            50% { opacity: 0.5; }
                            100% { opacity: 1; }
                          }
                        `}
                      </style>
                    </Box>
                  )}
                  <Chip 
                    label={stepStatus.toUpperCase()} 
                    size="small"
                    color={statusColor}
                    sx={{ fontWeight: 500 }}
                  />
                </Box>
              </Box>
              
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {stepMessage}
              </Typography>
              
              {stepStatus === 'processing' && stage.id === 3 && (
                <Typography variant="caption" color="primary" sx={{ display: 'block', mt: 0.5 }}>
                  AI processing document chunks...
                </Typography>
              )}
              
              {stepStatus === 'error' && step?.message && (
                <Typography variant="caption" color="error">
                  {step.message}
                </Typography>
              )}
            </Box>
          </Box>
        );
      })}
    </Box>
  );
};

export default ProcessingSteps;