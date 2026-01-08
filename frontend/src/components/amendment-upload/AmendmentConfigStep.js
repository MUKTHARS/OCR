import React from 'react';
import {
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  Alert,
  Box,
  Typography,
  Chip,
} from '@mui/material';
import {
  CompareArrowsOutlined,
  WarningAmberOutlined,
} from '@mui/icons-material';
import { amendmentTypes } from './AmendmentUtils';

const AmendmentConfigStep = ({ 
  amendmentType, 
  onChangeAmendmentType, 
  disabled = false 
}) => {
  return (
    <Box>
      <FormControl component="fieldset" sx={{ mb: 3 }}>
        <FormLabel sx={{ mb: 2, fontWeight: 600 }}>
          Amendment Type
        </FormLabel>
        <RadioGroup
          value={amendmentType}
          onChange={(e) => onChangeAmendmentType(e.target.value)}
        >
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
            {amendmentTypes.map((type) => (
              <FormControlLabel
                key={type.value}
                value={type.value}
                control={<Radio />}
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Chip 
                      label={type.label}
                      size="small"
                      variant="outlined"
                      sx={{ fontWeight: 500 }}
                    />
                  </Box>
                }
                disabled={disabled}
                sx={{
                  m: 0,
                  p: 1.5,
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 2,
                  '&.Mui-checked': {
                    borderColor: 'primary.main',
                    bgcolor: 'primary.50',
                  },
                }}
              />
            ))}
          </Box>
        </RadioGroup>
      </FormControl>

      <Alert 
        severity="info" 
        icon={<CompareArrowsOutlined />}
        sx={{ 
          border: '1px solid',
          borderColor: 'info.light',
          bgcolor: 'info.50',
        }}
      >
        <Typography variant="subtitle2" fontWeight={600} gutterBottom>
          Version Tracking Enabled
        </Typography>
        <Typography variant="body2">
          This amendment will be automatically compared with the parent contract.
          All changes will be tracked and highlighted for review.
        </Typography>
      </Alert>
    </Box>
  );
};

export default AmendmentConfigStep;