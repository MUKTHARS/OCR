import React, { useState, useEffect } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Typography,
  Box,
  TextField,
  Button,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import VisibilityIcon from '@mui/icons-material/Visibility';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { getContracts, searchContracts } from '../services/api';

const ContractList = ({ onSelectContract }) => {
  const [contracts, setContracts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchContracts();
  }, []);

  const fetchContracts = async () => {
    setLoading(true);
    try {
      const data = await getContracts();
      setContracts(data);
    } catch (error) {
      console.error('Error fetching contracts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      fetchContracts();
      return;
    }

    setLoading(true);
    try {
      const result = await searchContracts(searchQuery);
      setContracts(result.results || []);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  };

  const getConfidenceColor = (score) => {
    if (score >= 0.9) return 'success';
    if (score >= 0.7) return 'warning';
    return 'error';
  };

  return (
    <Box sx={{ width: '100%' }}>
      <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
        <TextField
          fullWidth
          variant="outlined"
          placeholder="Search contracts by terms, clauses, or parties..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
        />
        <Button
          variant="contained"
          onClick={handleSearch}
          startIcon={<SearchIcon />}
        >
          Search
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Contract Type</TableCell>
              <TableCell>Parties</TableCell>
              <TableCell>Effective Date</TableCell>
              <TableCell>Confidence</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  Loading...
                </TableCell>
              </TableRow>
            ) : contracts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  No contracts found
                </TableCell>
              </TableRow>
            ) : (
              contracts.map((contract) => (
                <TableRow key={contract.id} hover>
                  <TableCell>
                    <Typography fontWeight="medium">
                      {contract.contract_type}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                      {contract.parties?.slice(0, 2).map((party, idx) => (
                        <Typography key={idx} variant="body2">
                          {party}
                        </Typography>
                      ))}
                      {contract.parties?.length > 2 && (
                        <Typography variant="caption" color="text.secondary">
                          +{contract.parties.length - 2} more
                        </Typography>
                      )}
                    </Box>
                  </TableCell>
                  <TableCell>{formatDate(contract.effective_date)}</TableCell>
                  <TableCell>
                    <Chip
                      label={`${Math.round(contract.confidence_score * 100)}%`}
                      color={getConfidenceColor(contract.confidence_score)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    {contract.needs_review ? (
                      <Chip label="Needs Review" color="warning" size="small" />
                    ) : (
                      <Chip
                        icon={<CheckCircleIcon />}
                        label="Reviewed"
                        color="success"
                        size="small"
                      />
                    )}
                  </TableCell>
                  <TableCell>
                    <IconButton
                      size="small"
                      onClick={() => onSelectContract && onSelectContract(contract)}
                    >
                      <VisibilityIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default ContractList;