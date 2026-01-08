import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  TextField,
  Alert,
  Chip,
} from '@mui/material';
import {
  HistoryOutlined,
  DescriptionOutlined,
} from '@mui/icons-material';
import { amendmentTypes } from './UploadUtils';

const AmendmentDialog = ({
  open,
  onClose,
  onSubmit,
  isAmendment,
  setIsAmendment,
  parentDocumentId,
  setParentDocumentId,
  amendmentType,
  setAmendmentType,
  existingContracts = [],
  uploading = false,
}) => {
  return (
    <Dialog open={open} onClose={() => !uploading && onClose()}>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <HistoryOutlined />
          <Typography variant="h6">Is this an Amendment?</Typography>
        </Box>
      </DialogTitle>
      
      <DialogContent>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          This document appears to be an amendment. Please provide additional information:
        </Typography>
        
        <FormControl component="fieldset" sx={{ mt: 2, width: '100%' }}>
          <FormLabel sx={{ mb: 1, fontWeight: 600 }}>
            Document Type
          </FormLabel>
          <RadioGroup
            value={isAmendment.toString()}
            onChange={(e) => setIsAmendment(e.target.value === 'true')}
          >
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <FormControlLabel
                value="true"
                control={<Radio />}
                label={
                  <Box>
                    <Typography variant="body1" fontWeight={500}>
                      Yes, this is an amendment to an existing contract
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Select the parent contract below
                    </Typography>
                  </Box>
                }
                sx={{
                  m: 0,
                  p: 2,
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 2,
                  '&.Mui-checked': {
                    borderColor: 'primary.main',
                    bgcolor: 'primary.50',
                  },
                }}
              />
              
              <FormControlLabel
                value="false"
                control={<Radio />}
                label={
                  <Box>
                    <Typography variant="body1" fontWeight={500}>
                      No, this is a new contract
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Upload as a standalone contract
                    </Typography>
                  </Box>
                }
                sx={{
                  m: 0,
                  p: 2,
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 2,
                  '&.Mui-checked': {
                    borderColor: 'primary.main',
                    bgcolor: 'primary.50',
                  },
                }}
              />
            </Box>
          </RadioGroup>
        </FormControl>

        {isAmendment && (
          <Box sx={{ mt: 3 }}>
            <FormControl fullWidth sx={{ mb: 2 }}>
              <FormLabel sx={{ mb: 1, fontWeight: 600 }}>
                Amendment Type
              </FormLabel>
              <RadioGroup
                value={amendmentType}
                onChange={(e) => setAmendmentType(e.target.value)}
              >
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1 }}>
                  {amendmentTypes.map((type) => (
                    <FormControlLabel
                      key={type.value}
                      value={type.value}
                      control={<Radio size="small" />}
                      label={
                        <Chip 
                          label={type.label}
                          size="small"
                          variant="outlined"
                          sx={{ fontWeight: 500 }}
                        />
                      }
                      sx={{ m: 0 }}
                    />
                  ))}
                </Box>
              </RadioGroup>
            </FormControl>

            <FormControl fullWidth>
              <FormLabel sx={{ mb: 1, fontWeight: 600 }}>
                Select Parent Contract
              </FormLabel>
              <TextField
                select
                value={parentDocumentId}
                onChange={(e) => setParentDocumentId(e.target.value)}
                SelectProps={{ native: true }}
                variant="outlined"
                size="small"
                sx={{
                  '& .MuiSelect-select': {
                    py: 1.5,
                  }
                }}
              >
                <option value="">Select a contract...</option>
                {existingContracts.map((contract) => (
                  <option key={contract.id} value={contract.id}>
                    {contract.contract_type} - {contract.parties?.join(' & ')} (v{contract.version})
                  </option>
                ))}
              </TextField>
            </FormControl>
            
            <Alert 
              severity="info" 
              sx={{ mt: 2 }}
              icon={<DescriptionOutlined />}
            >
              <Typography variant="body2">
                Version tracking will automatically compare this amendment with the selected parent contract.
              </Typography>
            </Alert>
          </Box>
        )}
      </DialogContent>
      
      <DialogActions sx={{ p: 2, borderTop: '1px solid', borderColor: 'divider' }}>
        <Button 
          onClick={onClose} 
          disabled={uploading}
          sx={{ minWidth: 100 }}
        >
          Cancel
        </Button>
        <Button 
          onClick={onSubmit} 
          variant="contained" 
          disabled={uploading || (isAmendment && !parentDocumentId)}
          sx={{ minWidth: 100 }}
        >
          {uploading ? 'Processing...' : 'Proceed with Upload'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AmendmentDialog;