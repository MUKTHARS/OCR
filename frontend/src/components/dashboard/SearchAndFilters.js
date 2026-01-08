import React, { useState } from 'react';
import {
  Box,
  Paper,
  TextField,
  InputAdornment,
  Button,
  Chip,
  Menu,
  MenuItem,
  FormControl,
  Select,
  Typography,
} from '@mui/material';
import {
  SearchOutlined,
  FilterListOutlined,
  SortOutlined,
  CloseOutlined,
  CalendarTodayOutlined,
} from '@mui/icons-material';

const SearchAndFilters = ({ onSearch, onFilterChange, initialFilters = {} }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    status: initialFilters.status || 'all',
    risk: initialFilters.risk || 'all',
    type: initialFilters.type || 'all',
    dateRange: initialFilters.dateRange || 'all',
    ...initialFilters,
  });
  
  const [anchorEl, setAnchorEl] = useState(null);

  const handleFilterChange = (key, value) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    onFilterChange?.(newFilters);
  };

  const handleSearch = () => {
    onSearch?.(searchQuery);
  };

  const clearFilters = () => {
    const clearedFilters = {
      status: 'all',
      risk: 'all',
      type: 'all',
      dateRange: 'all',
    };
    setFilters(clearedFilters);
    onFilterChange?.(clearedFilters);
  };

  const activeFilterCount = Object.values(filters).filter(v => v !== 'all').length;

  return (
    <Paper sx={{ p: 2, mb: 3 }}>
      <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
        {/* Search Input */}
        <TextField
          placeholder="Search contracts, clauses, or parties..."
          variant="outlined"
          size="small"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
          sx={{ flex: 1, minWidth: 250 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchOutlined />
              </InputAdornment>
            ),
          }}
        />

        {/* Search Button */}
        <Button
          variant="contained"
          onClick={handleSearch}
          sx={{ whiteSpace: 'nowrap' }}
        >
          Search
        </Button>

        {/* Filter Button with Counter */}
        <Button
          variant="outlined"
          startIcon={<FilterListOutlined />}
          endIcon={activeFilterCount > 0 ? 
            <Chip label={activeFilterCount} size="small" color="primary" sx={{ ml: 1 }} /> : 
            undefined
          }
          onClick={(e) => setAnchorEl(e.currentTarget)}
          sx={{ whiteSpace: 'nowrap' }}
        >
          Filters
        </Button>

        {/* Sort Button */}
        <Button
          variant="outlined"
          startIcon={<SortOutlined />}
          sx={{ whiteSpace: 'nowrap' }}
        >
          Sort
        </Button>

        {/* Clear Filters Button (visible when filters are active) */}
        {activeFilterCount > 0 && (
          <Button
            variant="text"
            startIcon={<CloseOutlined />}
            onClick={clearFilters}
            sx={{ whiteSpace: 'nowrap' }}
          >
            Clear
          </Button>
        )}
      </Box>

      {/* Active Filters Chips */}
      {activeFilterCount > 0 && (
        <Box sx={{ display: 'flex', gap: 1, mt: 2, flexWrap: 'wrap' }}>
          {filters.status !== 'all' && (
            <Chip
              label={`Status: ${filters.status}`}
              size="small"
              onDelete={() => handleFilterChange('status', 'all')}
            />
          )}
          {filters.risk !== 'all' && (
            <Chip
              label={`Risk: ${filters.risk}`}
              size="small"
              color={filters.risk === 'high' ? 'error' : filters.risk === 'medium' ? 'warning' : 'success'}
              onDelete={() => handleFilterChange('risk', 'all')}
            />
          )}
          {filters.type !== 'all' && (
            <Chip
              label={`Type: ${filters.type}`}
              size="small"
              onDelete={() => handleFilterChange('type', 'all')}
            />
          )}
          {filters.dateRange !== 'all' && (
            <Chip
              label={`Date: ${filters.dateRange}`}
              size="small"
              icon={<CalendarTodayOutlined />}
              onDelete={() => handleFilterChange('dateRange', 'all')}
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
      >
        <Box sx={{ p: 2, minWidth: 200 }}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            Filter by:
          </Typography>
          
          <FormControl fullWidth size="small" sx={{ mb: 2 }}>
            <Typography variant="caption" gutterBottom>Status</Typography>
            <Select
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              size="small"
            >
              <MenuItem value="all">All Status</MenuItem>
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="expired">Expired</MenuItem>
              <MenuItem value="draft">Draft</MenuItem>
              <MenuItem value="review">Needs Review</MenuItem>
            </Select>
          </FormControl>

          <FormControl fullWidth size="small" sx={{ mb: 2 }}>
            <Typography variant="caption" gutterBottom>Risk Level</Typography>
            <Select
              value={filters.risk}
              onChange={(e) => handleFilterChange('risk', e.target.value)}
              size="small"
            >
              <MenuItem value="all">All Risk Levels</MenuItem>
              <MenuItem value="high">High Risk</MenuItem>
              <MenuItem value="medium">Medium Risk</MenuItem>
              <MenuItem value="low">Low Risk</MenuItem>
            </Select>
          </FormControl>

          <FormControl fullWidth size="small" sx={{ mb: 2 }}>
            <Typography variant="caption" gutterBottom>Contract Type</Typography>
            <Select
              value={filters.type}
              onChange={(e) => handleFilterChange('type', e.target.value)}
              size="small"
            >
              <MenuItem value="all">All Types</MenuItem>
              <MenuItem value="nda">NDA</MenuItem>
              <MenuItem value="msa">MSA</MenuItem>
              <MenuItem value="sow">SOW</MenuItem>
              <MenuItem value="po">Purchase Order</MenuItem>
              <MenuItem value="license">License Agreement</MenuItem>
            </Select>
          </FormControl>

          <FormControl fullWidth size="small">
            <Typography variant="caption" gutterBottom>Date Range</Typography>
            <Select
              value={filters.dateRange}
              onChange={(e) => handleFilterChange('dateRange', e.target.value)}
              size="small"
            >
              <MenuItem value="all">All Time</MenuItem>
              <MenuItem value="today">Today</MenuItem>
              <MenuItem value="week">This Week</MenuItem>
              <MenuItem value="month">This Month</MenuItem>
              <MenuItem value="quarter">This Quarter</MenuItem>
              <MenuItem value="year">This Year</MenuItem>
            </Select>
          </FormControl>

          <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
            <Button
              variant="outlined"
              fullWidth
              size="small"
              onClick={clearFilters}
            >
              Clear
            </Button>
            <Button
              variant="contained"
              fullWidth
              size="small"
              onClick={() => setAnchorEl(null)}
            >
              Apply
            </Button>
          </Box>
        </Box>
      </Menu>
    </Paper>
  );
};

export default SearchAndFilters;