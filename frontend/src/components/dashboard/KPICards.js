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

const KPICards = ({ summary, loading }) => {
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
    {
      title: 'Needs Legal Review',
      value: summary?.needs_review || 0,
      change: 15.3,
      icon: GavelOutlined,
      color: 'info',
      subtitle: 'Pending attention',
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