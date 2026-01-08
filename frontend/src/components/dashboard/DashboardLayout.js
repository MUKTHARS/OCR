import React from 'react';
import { Box, Container, ThemeProvider } from '@mui/material';
import DashboardTheme from './DashboardTheme';
import DashboardHeader from './DashboardHeader';
import KPICards from './KPICards';
import ContractMetrics from './ContractMetrics';
import RecentContracts from './RecentContracts';
import SearchAndFilters from './SearchAndFilters';
import ComparisonPanel from './ComparisonPanel';

const DashboardLayout = ({
  children,
  title,
  subtitle,
  summary,
  contracts = [],
  loading = false,
  onRefresh,
  onViewContract,
  onCompareContracts,
  selectedForCompare = [],
  onClearComparison,
  onRemoveFromComparison,
}) => {
  return (
    <ThemeProvider theme={DashboardTheme}>
      <Box sx={{ 
        minHeight: '100vh', 
        bgcolor: 'background.default',
        py: 3,
      }}>
        <Container maxWidth="xl">
          <DashboardHeader 
            title={title} 
            subtitle={subtitle} 
            onRefresh={onRefresh} 
          />
          
          <ComparisonPanel 
            selectedContracts={selectedForCompare}
            onCompare={onCompareContracts}
            onClear={onClearComparison}
            onRemoveContract={onRemoveFromComparison}
          />
          
          <KPICards summary={summary} loading={loading} />
          
          <ContractMetrics summary={summary} contracts={contracts} />
          
          <SearchAndFilters 
            onSearch={(query) => console.log('Search:', query)}
            onFilterChange={(filters) => console.log('Filters:', filters)}
          />
          
          <RecentContracts 
            contracts={contracts.slice(0, 10)}
            onViewContract={onViewContract}
            onCompare={(contract) => console.log('Compare:', contract)}
          />
          
          {children}
        </Container>
      </Box>
    </ThemeProvider>
  );
};

export default DashboardLayout;