import React from 'react';
import {
  Box,
  Tabs,
  Tab,
  Typography,
} from '@mui/material';
import {
  DescriptionOutlined,
  AttachMoneyOutlined,
  GavelOutlined,
  ArticleOutlined,
  HistoryOutlined,
  CodeOutlined,
} from '@mui/icons-material';

const ContractTabs = ({ activeTab, onChange, disabled }) => {
  const tabs = [
    {
      label: 'Overview',
      icon: <DescriptionOutlined fontSize="small" />,
    },
    {
      label: 'Financial',
      icon: <AttachMoneyOutlined fontSize="small" />,
    },
    {
      label: 'Legal & Compliance',
      icon: <GavelOutlined fontSize="small" />,
    },
    {
      label: 'Clauses',
      icon: <ArticleOutlined fontSize="small" />,
    },
    {
      label: 'Version History',
      icon: <HistoryOutlined fontSize="small" />,
      disabled: disabled?.versions,
    },
    {
      label: 'Raw View',
      icon: <CodeOutlined fontSize="small" />,
    },
  ];

  return (
    <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
      <Tabs 
        value={activeTab} 
        onChange={onChange}
        aria-label="contract detail tabs"
        sx={{
          minHeight: 48,
        }}
      >
        {tabs.map((tab, index) => (
          <Tab
            key={index}
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {tab.icon}
                <Typography variant="body2" fontWeight={500}>
                  {tab.label}
                </Typography>
              </Box>
            }
            disabled={tab.disabled}
            sx={{
              minHeight: 48,
              minWidth: 120,
            }}
          />
        ))}
      </Tabs>
    </Box>
  );
};

export default ContractTabs;