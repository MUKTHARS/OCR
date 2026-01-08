import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  LinearProgress,
  Chip,
} from '@mui/material';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import {
  AssessmentOutlined,
  TimelineOutlined,
} from '@mui/icons-material';

const ContractDistribution = ({ data }) => {
  const chartData = Object.entries(data || {}).map(([name, value]) => ({
    name: name || 'Unknown',
    value,
  }));

  const COLORS = ['#1a237e', '#0277bd', '#2e7d32', '#f57c00', '#546e7a'];

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <AssessmentOutlined sx={{ mr: 1.5, color: 'primary.main' }} />
          <Typography variant="h6" fontWeight={600}>
            Contract Distribution
          </Typography>
        </Box>
        
        <Box sx={{ height: 240, mb: 2 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => [`${value} contracts`, 'Count']} />
            </PieChart>
          </ResponsiveContainer>
        </Box>
        
        <Grid container spacing={1}>
          {chartData.map((item, index) => (
            <Grid item xs={6} key={index}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Box sx={{ 
                  width: 12, 
                  height: 12, 
                  borderRadius: 1, 
                  bgcolor: COLORS[index % COLORS.length],
                  mr: 1 
                }} />
                <Typography variant="caption" sx={{ flex: 1 }}>
                  {item.name}
                </Typography>
                <Typography variant="caption" fontWeight={600}>
                  {item.value}
                </Typography>
              </Box>
            </Grid>
          ))}
        </Grid>
      </CardContent>
    </Card>
  );
};

const RiskProgress = ({ contracts = [] }) => {
  const riskLevels = {
    high: { count: 0, label: 'High Risk', color: '#c62828' },
    medium: { count: 0, label: 'Medium Risk', color: '#f57c00' },
    low: { count: 0, label: 'Low Risk', color: '#2e7d32' },
  };

  contracts.forEach(contract => {
    const score = contract.risk_score || 0;
    if (score >= 0.7) riskLevels.high.count++;
    else if (score >= 0.3) riskLevels.medium.count++;
    else riskLevels.low.count++;
  });

  const total = contracts.length || 1;

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <TimelineOutlined sx={{ mr: 1.5, color: 'primary.main' }} />
          <Typography variant="h6" fontWeight={600}>
            Risk Distribution
          </Typography>
        </Box>
        
        <Box sx={{ mb: 3 }}>
          {Object.entries(riskLevels).map(([key, level]) => {
            const percentage = (level.count / total) * 100;
            return (
              <Box key={key} sx={{ mb: 2.5 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="body2" fontWeight={500}>
                    {level.label}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {level.count} ({percentage.toFixed(1)}%)
                  </Typography>
                </Box>
                <LinearProgress 
                  variant="determinate" 
                  value={percentage} 
                  sx={{ 
                    height: 8, 
                    borderRadius: 4,
                    backgroundColor: `${level.color}20`,
                    '& .MuiLinearProgress-bar': {
                      backgroundColor: level.color,
                      borderRadius: 4,
                    }
                  }} 
                />
              </Box>
            );
          })}
        </Box>
        
        <Box sx={{ 
          p: 2, 
          borderRadius: 2, 
          bgcolor: 'grey.50',
          border: '1px solid',
          borderColor: 'grey.200',
        }}>
          <Typography variant="caption" color="text.secondary">
            Based on {total} contract{total !== 1 ? 's' : ''} analyzed
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
};

const ContractMetrics = ({ summary, contracts }) => {
  return (
    <Grid container spacing={3} sx={{ mb: 4 }}>
      <Grid item xs={12} md={6}>
        <ContractDistribution data={summary?.by_type} />
      </Grid>
      <Grid item xs={12} md={6}>
        <RiskProgress contracts={contracts} />
      </Grid>
    </Grid>
  );
};

export default ContractMetrics;