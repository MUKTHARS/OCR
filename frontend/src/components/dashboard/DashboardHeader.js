import React from 'react';
import {
  Box,
  Typography,
  Breadcrumbs,
  Link,
  IconButton,
  Tooltip,
  Badge,
} from '@mui/material';
import {
  NotificationsOutlined,
  SettingsOutlined,
  PersonOutlined,
  RefreshOutlined,
  DashboardOutlined,
} from '@mui/icons-material';

const DashboardHeader = ({ title, subtitle, onRefresh }) => {
  return (
    <Box sx={{ mb: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
        <Box>
          <Breadcrumbs aria-label="breadcrumb" sx={{ mb: 1 }}>
            <Link color="inherit" href="#" sx={{ display: 'flex', alignItems: 'center' }}>
              <DashboardOutlined sx={{ mr: 0.5, fontSize: 16 }} />
              Contracts
            </Link>
            <Typography color="text.primary">Intelligence Dashboard</Typography>
          </Breadcrumbs>
          
          <Typography variant="h4" component="h1" fontWeight={600} sx={{ mb: 0.5 }}>
            {title || 'Contract Intelligence Dashboard'}
          </Typography>
          
          {subtitle && (
            <Typography variant="body1" color="text.secondary">
              {subtitle}
            </Typography>
          )}
        </Box>
        
        {/* <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Tooltip title="Refresh data">
            <IconButton 
              onClick={onRefresh}
              sx={{ 
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 2,
                p: 1,
              }}
            >
              <RefreshOutlined />
            </IconButton>
          </Tooltip>
          
          <Tooltip title="Notifications">
            <IconButton sx={{ position: 'relative' }}>
              <Badge badgeContent={3} color="error" variant="dot">
                <NotificationsOutlined />
              </Badge>
            </IconButton>
          </Tooltip>
          
          <Tooltip title="Settings">
            <IconButton>
              <SettingsOutlined />
            </IconButton>
          </Tooltip>
          
          <Tooltip title="Profile">
            <IconButton sx={{ 
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: '50%',
              p: 0.75,
            }}>
              <PersonOutlined />
            </IconButton>
          </Tooltip>
        </Box> */}
      </Box>
      
      <Box sx={{ 
        height: 1,
        width: '100%',
        background: 'linear-gradient(90deg, #1a237e 0%, #0277bd 50%, #2e7d32 100%)',
        borderRadius: 1,
        opacity: 0.1,
        mb: 2,
      }} />
    </Box>
  );
};

export default DashboardHeader;