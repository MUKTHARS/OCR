import React from 'react';
import {
  Paper,
  Typography,
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Tooltip,
  Button,
} from '@mui/material';
import {
  CompareArrowsOutlined,
  HistoryOutlined,
  CheckCircleOutlined,
  WarningAmberOutlined,
} from '@mui/icons-material';
import { formatDate, getRiskColor, getRiskLabel, getConfidenceColor } from '../contract-detail/ContractUtils';

const ContractVersions = ({ 
  versions = [], 
  currentVersion,
  onCompareVersions,
  loading = false 
}) => {
  if (loading) {
    return (
      <Paper sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          Loading version history...
        </Typography>
      </Paper>
    );
  }

  if (versions.length <= 1) {
    return (
      <Paper sx={{ p: 4, textAlign: 'center' }}>
        <HistoryOutlined sx={{ fontSize: 48, color: 'text.secondary', mb: 2, opacity: 0.5 }} />
        <Typography variant="h6" color="text.secondary" gutterBottom>
          No Version History
        </Typography>
        <Typography variant="body2" color="text.secondary">
          This is the first version of this contract
        </Typography>
      </Paper>
    );
  }

  return (
    <Paper sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h6" fontWeight={600}>
            Version History
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {versions.length} version{versions.length !== 1 ? 's' : ''} available
          </Typography>
        </Box>
        {versions.length > 1 && (
          <Button
            variant="outlined"
            startIcon={<CompareArrowsOutlined />}
            onClick={() => onCompareVersions(versions[0], versions[versions.length - 1])}
            sx={{ minWidth: 180 }}
          >
            Compare All Versions
          </Button>
        )}
      </Box>
      
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Version</TableCell>
              <TableCell>Extraction Date</TableCell>
              <TableCell>Confidence</TableCell>
              <TableCell>Risk Level</TableCell>
              <TableCell>Changes</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {versions.map((version, index) => (
              <TableRow 
                key={version.id} 
                hover
                sx={{ 
                  '&:hover': {
                    backgroundColor: 'action.hover',
                  }
                }}
              >
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body1" fontWeight={600}>
                      v{version.version}
                    </Typography>
                    {version.version === currentVersion && (
                      <Chip 
                        label="Current" 
                        size="small" 
                        color="primary"
                        sx={{ fontWeight: 500 }}
                      />
                    )}
                  </Box>
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <HistoryOutlined fontSize="small" color="action" />
                    <Typography variant="body2">
                      {formatDate(version.extraction_date)}
                    </Typography>
                  </Box>
                </TableCell>
                <TableCell>
                  <Chip
                    label={`${Math.round(version.confidence_score * 100)}%`}
                    size="small"
                    color={getConfidenceColor(version.confidence_score)}
                    variant="outlined"
                    sx={{ fontWeight: 500 }}
                  />
                </TableCell>
                <TableCell>
                  <Chip
                    label={getRiskLabel(version.risk_score)}
                    size="small"
                    color={getRiskColor(version.risk_score)}
                    variant="outlined"
                    sx={{ fontWeight: 500 }}
                  />
                </TableCell>
                <TableCell>
                  <Typography variant="body2" color="text.secondary">
                    {version.change_summary || 'Initial version'}
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end' }}>
                    {index > 0 && (
                      <Tooltip title="Compare with previous">
                        <IconButton
                          size="small"
                          onClick={() => onCompareVersions(versions[index - 1], version)}
                          sx={{ 
                            border: '1px solid',
                            borderColor: 'divider',
                            borderRadius: 2,
                          }}
                        >
                          <CompareArrowsOutlined fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                    <Tooltip title="View this version">
                      <IconButton 
                        size="small"
                        sx={{ 
                          border: '1px solid',
                          borderColor: 'divider',
                          borderRadius: 2,
                        }}
                      >
                        <HistoryOutlined fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
};

export default ContractVersions;