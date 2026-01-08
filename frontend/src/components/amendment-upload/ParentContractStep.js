import React from 'react';
import {
  FormControl,
  FormLabel,
  TextField,
  Card,
  CardContent,
  Typography,
  Box,
  Chip,
  Avatar,
  AvatarGroup,
} from '@mui/material';
import {
  DescriptionOutlined,
  PeopleOutlined,
  TrendingUpOutlined,
} from '@mui/icons-material';

const ParentContractStep = ({ 
  parentContract, 
  onSelectContract, 
  existingContracts = [],
  disabled = false 
}) => {
  return (
    <Box>
      <FormControl fullWidth sx={{ mb: 3 }}>
        <FormLabel sx={{ mb: 1, fontWeight: 600 }}>
          Search Parent Contract
        </FormLabel>
        <TextField
          select
          value={parentContract?.id || ''}
          onChange={(e) => {
            const contract = existingContracts.find(c => c.id === parseInt(e.target.value));
            onSelectContract(contract || null);
          }}
          SelectProps={{ native: true }}
          variant="outlined"
          size="small"
          disabled={disabled}
          sx={{
            '& .MuiSelect-select': {
              py: 1.5,
            }
          }}
        >
          <option value="">Select a parent contract...</option>
          {existingContracts.map((contract) => (
            <option key={contract.id} value={contract.id}>
              {contract.contract_type} - {contract.parties?.join(' & ')} (v{contract.version})
            </option>
          ))}
        </TextField>
      </FormControl>

      {parentContract && (
        <Card sx={{ 
          border: '2px solid',
          borderColor: 'primary.light',
          bgcolor: 'primary.50',
        }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="subtitle1" fontWeight={600}>
                Selected Parent Contract
              </Typography>
              <Chip 
                label={`v${parentContract.version}`}
                size="small"
                color="primary"
                variant="outlined"
                sx={{ fontWeight: 500 }}
              />
            </Box>
            
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box sx={{ 
                  p: 1, 
                  borderRadius: 2,
                  bgcolor: 'white',
                  color: 'primary.main',
                }}>
                  <DescriptionOutlined />
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    Contract Type
                  </Typography>
                  <Typography variant="body1" fontWeight={600}>
                    {parentContract.contract_type}
                  </Typography>
                  {parentContract.contract_subtype && (
                    <Typography variant="caption" color="text.secondary">
                      {parentContract.contract_subtype}
                    </Typography>
                  )}
                </Box>
              </Box>
              
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box sx={{ 
                  p: 1, 
                  borderRadius: 2,
                  bgcolor: 'white',
                  color: 'primary.main',
                }}>
                  <PeopleOutlined />
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    Parties
                  </Typography>
                  {parentContract.parties?.length > 0 ? (
                    <AvatarGroup max={3} sx={{ '& .MuiAvatar-root': { width: 28, height: 28, fontSize: '0.8rem' } }}>
                      {parentContract.parties.slice(0, 3).map((party, idx) => (
                        <Avatar 
                          key={idx} 
                          sx={{ bgcolor: 'primary.100', color: 'primary.main' }}
                        >
                          {party.charAt(0)}
                        </Avatar>
                      ))}
                    </AvatarGroup>
                  ) : (
                    <Typography variant="body2">No parties</Typography>
                  )}
                </Box>
              </Box>
              
              {parentContract.total_value && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Box sx={{ 
                    p: 1, 
                    borderRadius: 2,
                    bgcolor: 'white',
                    color: 'primary.main',
                  }}>
                    <TrendingUpOutlined />
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="caption" color="text.secondary">
                      Total Value
                    </Typography>
                    <Typography variant="body1" fontWeight={600}>
                      {parentContract.currency || 'USD'} {parentContract.total_value.toLocaleString()}
                    </Typography>
                  </Box>
                </Box>
              )}
            </Box>
          </CardContent>
        </Card>
      )}
    </Box>
  );
};

export default ParentContractStep;