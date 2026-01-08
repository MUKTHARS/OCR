import React, { useState } from 'react';
import {
  Box,
  TextField,
  Button,
  IconButton,
  InputAdornment,
  Menu,
  MenuItem,
  Chip,
  Typography,
  Tooltip,
} from '@mui/material';
import {
  SearchOutlined,
  FilterListOutlined,
  SortOutlined,
  ClearOutlined,
  DateRangeOutlined,
  PersonOutlined,
  AttachMoneyOutlined,
} from '@mui/icons-material';

const ContractFilters = ({ onSearch, onFilterChange, loading }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [anchorEl, setAnchorEl] = useState(null);
  const [filters, setFilters] = useState({
    status: 'all',
    risk: 'all',
    type: 'all',
    date: 'all',
  });

  const handleSearch = () => {
    onSearch(searchQuery);
  };

  const handleFilterChange = (filterType, value) => {
    const newFilters = { ...filters, [filterType]: value };
    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  const clearFilters = () => {
    setFilters({ status: 'all', risk: 'all', type: 'all', date: 'all' });
    setSearchQuery('');
    onFilterChange({ status: 'all', risk: 'all', type: 'all', date: 'all' });
    onSearch('');
  };

  const activeFilterCount = Object.values(filters).filter(v => v !== 'all').length;

  return (
    <Box sx={{ mb: 3 }}>
      <Box sx={{ 
        display: 'flex', 
        gap: 2, 
        alignItems: 'center',
        flexWrap: 'wrap'
      }}>
        {/* Search Field */}
        <TextField
          fullWidth
          variant="outlined"
          size="small"
          placeholder="Search by contract type, parties, clauses..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
          disabled={loading}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchOutlined fontSize="small" />
              </InputAdornment>
            ),
            sx: { 
              borderRadius: 2,
              bgcolor: 'background.paper',
            }
          }}
          sx={{ 
            flex: 1,
            minWidth: 300,
          }}
        />

        {/* Search Button */}
        <Button
          variant="contained"
          onClick={handleSearch}
          disabled={loading}
          startIcon={<SearchOutlined />}
          sx={{ 
            minWidth: 100,
          }}
        >
          Search
        </Button>

        {/* Filter Button */}
        <Button
          variant="outlined"
          onClick={(e) => setAnchorEl(e.currentTarget)}
          disabled={loading}
          startIcon={<FilterListOutlined />}
          endIcon={activeFilterCount > 0 ? 
            <Chip 
              label={activeFilterCount} 
              size="small" 
              color="primary"
              sx={{ ml: 1, height: 20, minWidth: 20 }}
            /> : 
            undefined
          }
        >
          Filter
        </Button>

        {/* Sort Button */}
        <Tooltip title="Sort options">
          <IconButton
            size="small"
            disabled={loading}
            sx={{ 
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 2,
              p: 1,
            }}
          >
            <SortOutlined fontSize="small" />
          </IconButton>
        </Tooltip>

        {/* Clear Filters */}
        {activeFilterCount > 0 && (
          <Button
            variant="text"
            onClick={clearFilters}
            disabled={loading}
            startIcon={<ClearOutlined />}
          >
            Clear
          </Button>
        )}
      </Box>

      {/* Active Filter Chips */}
      {activeFilterCount > 0 && (
        <Box sx={{ display: 'flex', gap: 1, mt: 2, flexWrap: 'wrap' }}>
          {filters.risk !== 'all' && (
            <Chip
              label={`Risk: ${filters.risk}`}
              size="small"
              onDelete={() => handleFilterChange('risk', 'all')}
              color={filters.risk === 'high' ? 'error' : 
                    filters.risk === 'medium' ? 'warning' : 'success'}
            />
          )}
          {filters.status !== 'all' && (
            <Chip
              label={`Status: ${filters.status}`}
              size="small"
              onDelete={() => handleFilterChange('status', 'all')}
            />
          )}
          {filters.type !== 'all' && (
            <Chip
              label={`Type: ${filters.type}`}
              size="small"
              onDelete={() => handleFilterChange('type', 'all')}
            />
          )}
          {filters.date !== 'all' && (
            <Chip
              label={`Date: ${filters.date}`}
              size="small"
              onDelete={() => handleFilterChange('date', 'all')}
              icon={<DateRangeOutlined fontSize="small" />}
            />
          )}
        </Box>
      )}

      {/* Filter Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        PaperProps={{
          sx: { 
            mt: 1,
            minWidth: 200,
            p: 2,
          }
        }}
      >
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          Filter by:
        </Typography>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          <Box>
            <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
              Risk Level
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.5 }}>
              {['all', 'low', 'medium', 'high'].map((risk) => (
                <Chip
                  key={risk}
                  label={risk === 'all' ? 'All' : risk}
                  size="small"
                  color={risk === 'high' ? 'error' : 
                        risk === 'medium' ? 'warning' : 
                        risk === 'low' ? 'success' : 'default'}
                  variant={filters.risk === risk ? 'filled' : 'outlined'}
                  onClick={() => handleFilterChange('risk', risk)}
                  sx={{ textTransform: 'capitalize' }}
                />
              ))}
            </Box>
          </Box>

          <Box>
            <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
              Status
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
              {['all', 'reviewed', 'needs-review', 'active', 'expired'].map((status) => (
                <Chip
                  key={status}
                  label={status === 'all' ? 'All' : status.replace('-', ' ')}
                  size="small"
                  variant={filters.status === status ? 'filled' : 'outlined'}
                  onClick={() => handleFilterChange('status', status)}
                  sx={{ textTransform: 'capitalize' }}
                />
              ))}
            </Box>
          </Box>
        </Box>

        <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
          <Button
            variant="contained"
            fullWidth
            size="small"
            onClick={() => setAnchorEl(null)}
          >
            Apply Filters
          </Button>
        </Box>
      </Menu>
    </Box>
  );
};

export default ContractFilters;