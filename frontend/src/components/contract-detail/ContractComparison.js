import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Alert,
} from '@mui/material';
import {
  CompareArrowsOutlined,
  CloseOutlined,
} from '@mui/icons-material';

const getImpactLevel = (fieldName, changeType) => {
  const highImpactFields = ['total_value', 'parties', 'effective_date', 'expiration_date'];
  const mediumImpactFields = ['payment_terms', 'governing_law', 'jurisdiction', 'confidentiality'];
  
  if (highImpactFields.some(field => fieldName.includes(field))) {
    return (
      <Chip
        label="High Impact"
        size="small"
        color="error"
        variant="outlined"
        sx={{ fontWeight: 500 }}
      />
    );
  }
  
  if (mediumImpactFields.some(field => fieldName.includes(field))) {
    return (
      <Chip
        label="Medium Impact"
        size="small"
        color="warning"
        variant="outlined"
        sx={{ fontWeight: 500 }}
      />
    );
  }
  
  return (
    <Chip
      label="Low Impact"
      size="small"
      color="default"
      variant="outlined"
      sx={{ fontWeight: 500 }}
    />
  );
};

const ContractComparison = ({ 
  open,
  onClose,
  selectedVersions = [],
  deltas = [],
}) => {
  if (selectedVersions.length !== 2) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: { borderRadius: 2 }
      }}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CompareArrowsOutlined />
          <Typography variant="h6">Version Comparison</Typography>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          v{selectedVersions[0]?.version} vs v{selectedVersions[1]?.version}
        </Typography>
      </DialogTitle>
      
      <DialogContent>
        {deltas.length > 0 ? (
          <Box sx={{ mt: 1 }}>
            <Alert severity="info" sx={{ mb: 3 }}>
              <Typography variant="subtitle2">
                Found {deltas.length} change{deltas.length !== 1 ? 's' : ''} between versions
              </Typography>
            </Alert>
            
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Field</TableCell>
                    <TableCell>Change Type</TableCell>
                    <TableCell>Previous Value</TableCell>
                    <TableCell>New Value</TableCell>
                    <TableCell>Impact</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {deltas.map((delta, idx) => (
                    <TableRow key={idx} hover>
                      <TableCell>
                        <Typography variant="body2" fontWeight={600}>
                          {delta.field_name.replace(/\./g, ' → ')}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={delta.change_type}
                          size="small"
                          color={
                            delta.change_type === 'added' ? 'success' : 
                            delta.change_type === 'removed' ? 'error' : 'warning'
                          }
                          variant="outlined"
                          sx={{ fontWeight: 500 }}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {delta.old_value ? 
                            (typeof delta.old_value === 'string' ? 
                              delta.old_value.slice(0, 100) : 
                              JSON.stringify(delta.old_value).slice(0, 100)) : 
                            '—'
                          }
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {delta.new_value ? 
                            (typeof delta.new_value === 'string' ? 
                              delta.new_value.slice(0, 100) : 
                              JSON.stringify(delta.new_value).slice(0, 100)) : 
                            '—'
                          }
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {getImpactLevel(delta.field_name, delta.change_type)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        ) : (
          <Alert severity="info" sx={{ mt: 2 }}>
            No changes detected between selected versions
          </Alert>
        )}
      </DialogContent>
      
      <DialogActions sx={{ p: 2, borderTop: '1px solid', borderColor: 'divider' }}>
        <Button 
          onClick={onClose}
          startIcon={<CloseOutlined />}
        >
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ContractComparison;