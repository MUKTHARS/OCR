import React from 'react';
import {
  Stepper,
  Step,
  StepLabel,
  Box,
  Typography,
} from '@mui/material';
import {
  FolderOpenOutlined,
  DescriptionOutlined,
  CompareArrowsOutlined,
  CloudUploadOutlined,
} from '@mui/icons-material';

const steps = [
  {
    label: 'Select Amendment Files',
    description: 'Upload the amendment documents from your folder',
    icon: <FolderOpenOutlined />,
  },
  {
    label: 'Identify Parent Contract',
    description: 'Select which contract this amendment modifies',
    icon: <DescriptionOutlined />,
  },
  {
    label: 'Configure Amendment',
    description: 'Specify amendment type and details',
    icon: <CompareArrowsOutlined />,
  },
  {
    label: 'Upload & Process',
    description: 'Upload amendments and wait for processing',
    icon: <CloudUploadOutlined />,
  },
];

const UploadStepper = ({ activeStep, uploading }) => {
  return (
    <Stepper activeStep={activeStep} orientation="vertical">
      {steps.map((step, index) => (
        <Step key={step.label}>
          <StepLabel
            StepIconComponent={() => (
              <Box sx={{ 
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 32,
                height: 32,
                borderRadius: '50%',
                bgcolor: activeStep >= index ? 'primary.main' : 'grey.100',
                color: activeStep >= index ? 'white' : 'grey.400',
                border: '2px solid',
                borderColor: activeStep >= index ? 'primary.main' : 'grey.300',
              }}>
                {step.icon}
              </Box>
            )}
          >
            <Box>
              <Typography variant="subtitle1" fontWeight={600}>
                {step.label}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {step.description}
              </Typography>
            </Box>
          </StepLabel>
        </Step>
      ))}
    </Stepper>
  );
};

export default UploadStepper;