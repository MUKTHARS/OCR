import React, { useState, useEffect } from 'react';
import {
  Container,
  AppBar,
  Toolbar,
  Box,
  CssBaseline,
  Alert,
  IconButton,
  Menu,
  MenuItem,
  Avatar,
  Badge,
  Divider,
  Chip,
  useTheme,
  useMediaQuery,
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Typography,
} from '@mui/material';
import {
  Menu as MenuIcon,
  NotificationsOutlined,
  SettingsOutlined,
  PersonOutlined,
  DashboardOutlined,
  UploadFileOutlined,
  HistoryOutlined,
  ListAltOutlined,
  DescriptionOutlined,
  LogoutOutlined,
} from '@mui/icons-material';
import EnhancedDocumentUpload from './components/document-upload/EnhancedDocumentUpload';
import ContractList from './components/contract-list/ContractList';
import ContractDetail from './components/contract-detail/ContractDetail';
import AmendmentUpload from './components/amendment-upload/AmendmentUpload';
import { getContracts, getContractSummary, compareContracts } from './services/api';
import DashboardLayout from './components/dashboard/DashboardLayout';
import sapleLogo from './uploads/saple-logo.webp';

function App() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [activeTab, setActiveTab] = useState(0);
  const [selectedContractId, setSelectedContractId] = useState(null);
  const [refreshList, setRefreshList] = useState(false);
  const [existingContracts, setExistingContracts] = useState([]);
  const [isProcessingUpload, setIsProcessingUpload] = useState(false);
  const [summary, setSummary] = useState(null);
  const [selectedForCompare, setSelectedForCompare] = useState([]);
  const [loading, setLoading] = useState(true);
  const [anchorEl, setAnchorEl] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Tab configuration
  const tabs = [
    { id: 0, label: 'Dashboard', icon: <DashboardOutlined />, disabled: isProcessingUpload },
    { 
      id: 1, 
      label: isProcessingUpload ? 'Processing Upload...' : 'Upload Contract', 
      icon: <UploadFileOutlined />,
      disabled: isProcessingUpload && activeTab !== 1 
    },
    { id: 2, label: 'Upload Amendment', icon: <HistoryOutlined />, disabled: isProcessingUpload },
    { id: 3, label: 'Contract List', icon: <ListAltOutlined />, disabled: isProcessingUpload },
    { 
      id: 4, 
      label: 'Contract Details', 
      icon: <DescriptionOutlined />,
      disabled: !selectedContractId || isProcessingUpload 
    },
  ];

  useEffect(() => {
    fetchDashboardData();
  }, [refreshList]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [summaryData, contractsData] = await Promise.all([
        getContractSummary(),
        getContracts(0, 50)
      ]);
      setSummary(summaryData);
      setExistingContracts(contractsData);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (event, newValue) => {
    if (isProcessingUpload && newValue !== 1) {
      alert('Please wait for document processing to complete before switching tabs.');
      return;
    }
    setActiveTab(newValue);
    if (newValue !== 4) {
      setSelectedContractId(null);
    }
    if (isMobile) {
      setDrawerOpen(false);
    }
  };

  const handleUploadStart = () => {
    setIsProcessingUpload(true);
  };

  const handleUploadSuccess = (result) => {
    console.log('Upload completed successfully:', result);
    setIsProcessingUpload(false);
    setRefreshList(!refreshList);
    setTimeout(() => {
      setActiveTab(3); // Navigate to Contract List
    }, 500);
  };

  const handleUploadError = () => {
    setIsProcessingUpload(false);
  };

  const handleSelectContract = (contract) => {
    setSelectedContractId(contract.id);
    setActiveTab(4);
    if (isMobile) {
      setDrawerOpen(false);
    }
  };

  const handleReviewUpdate = () => {
    setRefreshList(!refreshList);
  };

  const handleCompareSelect = (contract) => {
    if (selectedForCompare.some(c => c.id === contract.id)) {
      setSelectedForCompare(selectedForCompare.filter(c => c.id !== contract.id));
    } else if (selectedForCompare.length < 2) {
      setSelectedForCompare([...selectedForCompare, contract]);
    }
  };

  const handleCompareContracts = async () => {
    if (selectedForCompare.length !== 2) return;
    
    try {
      const result = await compareContracts(
        selectedForCompare[0].id, 
        selectedForCompare[1].id
      );
      console.log('Comparison result:', result);
      alert('Comparison complete! Check console for details.');
    } catch (error) {
      console.error('Error comparing contracts:', error);
      alert('Failed to compare contracts');
    }
  };

  const handleClearComparison = () => {
    setSelectedForCompare([]);
  };

  const handleRemoveFromComparison = (contractId) => {
    setSelectedForCompare(selectedForCompare.filter(c => c.id !== contractId));
  };

  const handleMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const renderActiveContent = () => {
    switch (activeTab) {
      case 0:
        return (
          <DashboardLayout
            title="Contract Intelligence Dashboard"
            subtitle="Real-time insights and analytics for your contract portfolio"
            summary={summary}
            contracts={existingContracts}
            loading={loading}
            onRefresh={fetchDashboardData}
            onViewContract={handleSelectContract}
            onCompareContracts={handleCompareContracts}
            selectedForCompare={selectedForCompare}
            onClearComparison={handleClearComparison}
            onRemoveFromComparison={handleRemoveFromComparison}
          />
        );
      case 1:
        return (
          <EnhancedDocumentUpload 
            onUploadStart={handleUploadStart}
            onUploadSuccess={handleUploadSuccess}
            onUploadError={handleUploadError}
            existingContracts={existingContracts}
          />
        );
      case 2:
        return (
          <AmendmentUpload 
            onUploadSuccess={handleUploadSuccess}
            existingContracts={existingContracts}
          />
        );
      case 3:
        return (
          <ContractList
            key={refreshList}
            onSelectContract={handleSelectContract}
          />
        );
      case 4:
        return selectedContractId ? (
          <ContractDetail
            contractId={selectedContractId}
            onReviewUpdate={handleReviewUpdate}
          />
        ) : (
          <Alert severity="info" sx={{ mt: 4 }}>
            Please select a contract to view details.
          </Alert>
        );
      default:
        return null;
    }
  };

  // Mobile drawer content
  const drawerContent = (
    <Box sx={{ width: 280, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ p: 3, borderBottom: 1, borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 2 }}>
        <Box sx={{ 
          width: 40, 
          height: 40, 
          borderRadius: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}>
          <img 
            src={sapleLogo}
            alt="Saple AI"
            style={{ 
              width: '100%', 
              height: '100%',
              objectFit: 'contain',
            }}
            onError={(e) => {
              e.target.style.display = 'none';
              const fallback = document.createElement('div');
              fallback.style.color = 'text.primary';
              fallback.style.fontWeight = '600';
              fallback.style.fontSize = '1.25rem';
              fallback.innerText = 'SAI';
              e.target.parentElement.appendChild(fallback);
            }}
          />
        </Box>
        <Box>
          <Typography variant="subtitle1" fontWeight={600}>
            Saple AI
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Contract Intelligence
          </Typography>
        </Box>
      </Box>
      
      <List sx={{ flex: 1, p: 2 }}>
        {tabs.map((tab) => (
          <ListItem
            key={tab.id}
            button
            selected={activeTab === tab.id}
            onClick={() => handleTabChange(null, tab.id)}
            disabled={tab.disabled}
            sx={{
              borderRadius: 2,
              mb: 1,
              '&.Mui-selected': {
                bgcolor: 'primary.50',
                color: 'primary.main',
                '&:hover': {
                  bgcolor: 'primary.50',
                },
              },
            }}
          >
            <ListItemIcon sx={{ minWidth: 40 }}>
              {React.cloneElement(tab.icon, {
                color: activeTab === tab.id ? 'primary' : 'action'
              })}
            </ListItemIcon>
            <ListItemText 
              primary={tab.label} 
              primaryTypographyProps={{ 
                fontSize: '0.875rem',
                fontWeight: activeTab === tab.id ? 600 : 400 
              }}
            />
          </ListItem>
        ))}
      </List>
      
      <Divider />
      
      <Box sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
          <Avatar sx={{ bgcolor: 'primary.100', color: 'primary.main' }}>
            <PersonOutlined />
          </Avatar>
          <Box>
            <Typography variant="body2" fontWeight={600}>
              Admin User
            </Typography>
            <Typography variant="caption" color="text.secondary">
              admin@saple.ai
            </Typography>
          </Box>
        </Box>
        
        <ListItem button sx={{ borderRadius: 2 }}>
          <ListItemIcon sx={{ minWidth: 40 }}>
            <LogoutOutlined fontSize="small" />
          </ListItemIcon>
          <ListItemText 
            primary="Sign Out" 
            primaryTypographyProps={{ fontSize: '0.875rem' }}
          />
        </ListItem>
      </Box>
    </Box>
  );

  return (
    <>
      <CssBaseline />
      
      {/* App Bar */}
      <AppBar 
        position="fixed" 
        elevation={0} 
        sx={{ 
          bgcolor: '#ffffff',
          borderBottom: '1px solid',
          borderColor: 'divider',
          zIndex: theme.zIndex.drawer + 1,
        }}
      >
        <Toolbar sx={{ minHeight: 64 }}>
          {isMobile && (
            <IconButton
              edge="start"
              color="inherit"
              onClick={() => setDrawerOpen(true)}
              sx={{ mr: 2, color: 'text.primary' }}
            >
              <MenuIcon />
            </IconButton>
          )}
          
          {/* Logo - Made LARGER */}
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 2,
            flex: 1 
          }}>
            <Box sx={{ 
              width: 120, // INCREASED from 40
              height: 40, // Keep same height for toolbar alignment
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              bgcolor: 'transparent',
            }}>
              <img 
                src={sapleLogo}
                alt="Saple AI"
                style={{ 
                  width: '100%', 
                  height: 'auto', // Changed to auto to maintain aspect ratio
                  objectFit: 'contain',
                  maxHeight: 40, // Ensure it doesn't exceed toolbar height
                }}
                onError={(e) => {
                  e.target.style.display = 'none';
                  const fallback = document.createElement('div');
                  fallback.style.color = 'text.primary';
                  fallback.style.fontWeight = '600';
                  fallback.style.fontSize = '1.5rem'; // Increased font size
                  fallback.style.display = 'flex';
                  fallback.style.alignItems = 'center';
                  fallback.style.justifyContent = 'center';
                  fallback.style.width = '100%';
                  fallback.style.height = '100%';
                  fallback.innerText = 'Saple AI';
                  e.target.parentElement.appendChild(fallback);
                }}
              />
            </Box>
            
            {!isMobile && (
              <Box sx={{ ml: 1 }}>
                <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.primary' }}>
                  Saple AI
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Contract Intelligence
                </Typography>
              </Box>
            )}
          </Box>
          
          {/* Desktop Navigation */}
          {!isMobile && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box sx={{ 
                display: 'flex', 
                gap: 1,
                bgcolor: 'grey.50',
                borderRadius: 3,
                p: 0.5,
              }}>
                {tabs.map((tab) => (
                  <Chip
                    key={tab.id}
                    label={tab.label}
                    onClick={() => handleTabChange(null, tab.id)}
                    disabled={tab.disabled}
                    color={activeTab === tab.id ? 'primary' : 'default'}
                    variant={activeTab === tab.id ? 'filled' : 'outlined'}
                    size="small"
                    sx={{ 
                      fontWeight: 500,
                      borderRadius: 2,
                      '&.MuiChip-filledPrimary': {
                        bgcolor: 'primary.main',
                      }
                    }}
                  />
                ))}
              </Box>
            </Box>
          )}
          
          {/* Action Icons */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, ml: 2 }}>
            <IconButton size="small">
              <Badge badgeContent={3} color="error" variant="dot">
                <NotificationsOutlined fontSize="small" />
              </Badge>
            </IconButton>
            
            <IconButton size="small">
              <SettingsOutlined fontSize="small" />
            </IconButton>
            
            <IconButton 
              size="small" 
              onClick={handleMenuOpen}
              sx={{ 
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: '50%',
                p: 0.5,
              }}
            >
              <PersonOutlined fontSize="small" />
            </IconButton>
            
            <Menu
              anchorEl={anchorEl}
              open={Boolean(anchorEl)}
              onClose={handleMenuClose}
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
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                  <Avatar sx={{ bgcolor: 'primary.100', color: 'primary.main' }}>
                    <PersonOutlined />
                  </Avatar>
                  <Box>
                    <Typography variant="body2" fontWeight={600}>
                      Admin User
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      admin@saple.ai
                    </Typography>
                  </Box>
                </Box>
                
                <Divider sx={{ my: 1 }} />
                
                <MenuItem onClick={handleMenuClose}>
                  <ListItemIcon>
                    <SettingsOutlined fontSize="small" />
                  </ListItemIcon>
                  <ListItemText primary="Settings" />
                </MenuItem>
                
                <MenuItem onClick={handleMenuClose}>
                  <ListItemIcon>
                    <LogoutOutlined fontSize="small" />
                  </ListItemIcon>
                  <ListItemText primary="Sign Out" />
                </MenuItem>
              </Box>
            </Menu>
          </Box>
        </Toolbar>
      </AppBar>
      
      {/* Mobile Drawer */}
      <Drawer
        anchor="left"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        sx={{
          '& .MuiDrawer-paper': {
            width: 280,
          },
        }}
      >
        {drawerContent}
      </Drawer>
      
      {/* Main Content */}
      <Box sx={{ 
        pt: 8, // Account for AppBar height
        minHeight: 'calc(100vh - 64px)',
        bgcolor: 'background.default',
      }}>
        {isProcessingUpload && (
          <Container maxWidth="xl">
            <Alert 
              severity="info" 
              sx={{ 
                mb: 3, 
                mt: 2,
                borderRadius: 2,
                border: '1px solid',
                borderColor: 'info.light',
              }}
            >
              <Typography variant="body2" fontWeight={500}>
                Please wait while we process your contract. Do not navigate away from this page.
              </Typography>
            </Alert>
          </Container>
        )}
        
        {!isMobile && activeTab === 0 && (
          <Box sx={{ 
            height: 1,
            width: '100%',
            background: 'linear-gradient(90deg, #1a237e 0%, #0277bd 50%, #2e7d32 100%)',
            opacity: 0.05,
            position: 'absolute',
            top: 64,
            left: 0,
            zIndex: 0,
          }} />
        )}
        
        <Container maxWidth="xl" sx={{ position: 'relative', zIndex: 1 }}>
          {/* Active Content */}
          {renderActiveContent()}
        </Container>
      </Box>
      
      {/* Footer */}
      <Box sx={{ 
        bgcolor: 'grey.50',
        borderTop: '1px solid',
        borderColor: 'divider',
        py: 2,
      }}>
        <Container maxWidth="xl">
          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 2,
          }}>
            <Typography variant="caption" color="text.secondary">
              © {new Date().getFullYear()} Saple AI Intelligence. All rights reserved.
            </Typography>
            
            <Box sx={{ display: 'flex', gap: 3 }}>
              <Typography variant="caption" color="text.secondary" sx={{ cursor: 'pointer' }}>
                Privacy Policy
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ cursor: 'pointer' }}>
                Terms of Service
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ cursor: 'pointer' }}>
                Support
              </Typography>
            </Box>
          </Box>
        </Container>
      </Box>
    </>
  );
}

export default App;