import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  Skeleton,
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  ArrowRight,
  MonetizationOnOutlined,
  WarningAmberOutlined,
  ScheduleOutlined,
  GavelOutlined,
  AccountBalanceOutlined,
  PaidOutlined,
  PendingActionsOutlined,
} from '@mui/icons-material';

const KPICard = ({ 
  title, 
  value, 
  change, 
  icon, 
  loading = false,
  color = 'primary',
  format = 'number',
  subtitle,
}) => {
  const getColor = () => {
    const colors = {
      primary: '#1a237e',
      success: '#2e7d32',
      warning: '#f57c00',
      error: '#c62828',
      info: '#0277bd',
    };
    return colors[color] || colors.primary;
  };

  const formatValue = (val) => {
    if (format === 'currency') {
      return `$${Number(val).toLocaleString('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      })}`;
    }
    if (format === 'percentage') {
      return `${Number(val).toFixed(1)}%`;
    }
    return Number(val).toLocaleString();
  };

  const IconComponent = icon;

  if (loading) {
    return (
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Skeleton variant="text" width={120} height={24} />
            <Skeleton variant="circular" width={40} height={40} />
          </Box>
          <Skeleton variant="text" width={80} height={32} />
          <Skeleton variant="text" width={160} height={20} sx={{ mt: 1 }} />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
          <Typography variant="subtitle2" color="text.secondary" fontWeight={500}>
            {title}
          </Typography>
          <Box sx={{
            p: 1,
            borderRadius: 2,
            bgcolor: `${color}.50`,
            color: getColor(),
          }}>
            {IconComponent && <IconComponent fontSize="small" />}
          </Box>
        </Box>
        
        <Typography variant="h3" component="div" fontWeight={600} sx={{ mb: 1 }}>
          {formatValue(value)}
        </Typography>
        
        {subtitle && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
            {subtitle}
          </Typography>
        )}
        
        {change !== undefined && (
          <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
            {change > 0 ? (
              <>
                <TrendingUp sx={{ fontSize: 16, color: 'success.main', mr: 0.5 }} />
                <Typography variant="caption" color="success.main" fontWeight={500}>
                  +{change}%
                </Typography>
              </>
            ) : change < 0 ? (
              <>
                <TrendingDown sx={{ fontSize: 16, color: 'error.main', mr: 0.5 }} />
                <Typography variant="caption" color="error.main" fontWeight={500}>
                  {change}%
                </Typography>
              </>
            ) : (
              <>
                <ArrowRight sx={{ fontSize: 16, color: 'text.secondary', mr: 0.5 }} />
                <Typography variant="caption" color="text.secondary" fontWeight={500}>
                  No change
                </Typography>
              </>
            )}
            <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
              from last period
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

const KPICards = ({ summary, loading, contracts = [] }) => {
  // Calculate funding metrics from contracts
  const calculateFundingMetrics = () => {
    if (!contracts || contracts.length === 0) {
      return {
        totalFunding: 0,
        totalReceived: 0,
        remainingFunds: 0,
        utilizationRate: 0,
      };
    }

    let totalFunding = 0;
    let totalReceived = 0;
    let totalCommitted = 0;

    contracts.forEach(contract => {
      const totalValue = contract.total_value || 0;
      totalFunding += totalValue;
      
      // Simple logic to calculate received funds
      // In a real app, this would come from payment schedules
      if (contract.extracted_metadata?.payment_schedule) {
        const schedule = contract.extracted_metadata.payment_schedule;
        if (Array.isArray(schedule)) {
          schedule.forEach(item => {
            if (item.amount) {
              const amount = typeof item.amount === 'string' 
                ? parseFloat(item.amount.replace(/[^0-9.-]+/g, "")) 
                : item.amount;
              totalCommitted += amount;
              if (item.status === 'paid' || item.status === 'completed') {
                totalReceived += amount;
              }
            }
          });
        }
      } else {
        // Fallback: assume 40% of total value is received
        totalReceived += totalValue * 0.4;
        totalCommitted += totalValue;
      }
    });

    return {
      totalFunding,
      totalReceived,
      totalCommitted: totalCommitted || totalFunding,
      remainingFunds: (totalCommitted || totalFunding) - totalReceived,
      utilizationRate: (totalCommitted || totalFunding) > 0 
        ? (totalReceived / (totalCommitted || totalFunding)) * 100 
        : 0,
    };
  };

  const fundingMetrics = calculateFundingMetrics();

  const cards = [
    {
      title: 'Total Portfolio Value',
      value: summary?.total_value || 0,
      change: 12.5,
      icon: MonetizationOnOutlined,
      color: 'success',
      format: 'currency',
      subtitle: `Across ${summary?.total_contracts || 0} contracts`,
    },
    {
      title: 'Total Funding',
      value: fundingMetrics.totalFunding,
      change: 12.5,
      icon: AccountBalanceOutlined,
      color: 'primary',
      format: 'currency',
      subtitle: `Across ${contracts.length} grants`,
    },
    {
      title: 'Funds Received',
      value: fundingMetrics.totalReceived,
      change: 8.2,
      icon: PaidOutlined,
      color: 'success',
      format: 'currency',
      subtitle: `${fundingMetrics.utilizationRate.toFixed(1)}% utilization`,
    },
    {
      title: 'Remaining Funds',
      value: fundingMetrics.remainingFunds,
      change: -4.3,
      icon: PendingActionsOutlined,
      color: 'warning',
      format: 'currency',
      subtitle: 'Pending disbursement',
    },
  

    {
      title: 'Needs Legal Review',
      value: summary?.needs_review || 0,
      change: 15.3,
      icon: GavelOutlined,
      color: 'info',
      subtitle: 'Pending attention',
    },
    
    {
      title: 'Active Grants',
      value: contracts.filter(c => !c.termination_date).length,
      change: 5.2,
      icon: AccountBalanceOutlined,
      color: 'primary',
      subtitle: `${contracts.length} total grants`,
    },

        {
      title: 'High Risk Contracts',
      value: summary?.high_risk || 0,
      change: -4.2,
      icon: WarningAmberOutlined,
      color: 'error',
      subtitle: summary?.total_contracts ? 
        `${((summary.high_risk / summary.total_contracts) * 100).toFixed(1)}% of portfolio` : 
        'No contracts',
    },
    {
      title: 'Expiring Soon',
      value: summary?.expiring_soon || 0,
      change: 8.7,
      icon: ScheduleOutlined,
      color: 'warning',
      subtitle: 'Within next 90 days',
    },
  ];

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: 'repeat(4, 1fr)' }, gap: 3, mb: 4 }}>
      {cards.map((card, index) => (
        <KPICard key={index} {...card} loading={loading} />
      ))}
    </Box>
  );
};

export default KPICards;