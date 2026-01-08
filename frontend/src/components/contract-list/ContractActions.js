import React from 'react';
import {
  Box,
  Chip,
  IconButton,
  Tooltip,
  Avatar,
  AvatarGroup,
} from '@mui/material';
import { Typography } from '@mui/material';
import {
  VisibilityOutlined,
  CompareOutlined,
  CheckCircleOutlined,
  WarningAmberOutlined,
  PersonOutlined,
  CalendarTodayOutlined,
  AttachMoneyOutlined,
} from '@mui/icons-material';

export const getRiskColor = (score) => {
  if (score >= 0.7) return 'error';
  if (score >= 0.3) return 'warning';
  return 'success';
};

export const getRiskLabel = (score) => {
  if (score >= 0.7) return 'High';
  if (score >= 0.3) return 'Medium';
  return 'Low';
};

export const getConfidenceColor = (score) => {
  if (score >= 0.9) return 'success';
  if (score >= 0.7) return 'warning';
  return 'error';
};

export const formatDate = (dateString) => {
  if (!dateString) return '—';
  const date = new Date(dateString);
  const now = new Date();
  const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

export const formatCurrency = (value, currency = 'USD') => {
  if (!value && value !== 0) return '—';
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  return formatter.format(value);
};

export const ContractTypeCell = ({ contract }) => (
  <Box>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
      <Typography variant="body2" fontWeight={600}>
        {contract.contract_type || 'Unknown'}
      </Typography>
      {contract.master_agreement_id && (
        <Chip 
          label={`ID: ${contract.master_agreement_id}`}
          size="small"
          variant="outlined"
          sx={{ height: 20, fontSize: '0.7rem' }}
        />
      )}
    </Box>
    {contract.contract_subtype && (
      <Typography variant="caption" color="text.secondary">
        {contract.contract_subtype}
      </Typography>
    )}
  </Box>
);

export const PartiesCell = ({ parties }) => {
  if (!parties || parties.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        No parties
      </Typography>
    );
  }

  return (
    <AvatarGroup max={2} sx={{ '& .MuiAvatar-root': { width: 28, height: 28, fontSize: '0.8rem' } }}>
      {parties.slice(0, 2).map((party, idx) => (
        <Tooltip key={idx} title={party}>
          <Avatar sx={{ bgcolor: 'primary.100', color: 'primary.main' }}>
            {party.charAt(0).toUpperCase()}
          </Avatar>
        </Tooltip>
      ))}
    </AvatarGroup>
  );
};

export const ValueCell = ({ value, currency }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
    <AttachMoneyOutlined sx={{ fontSize: 14, color: 'success.main' }} />
    <Typography variant="body2" fontWeight={500}>
      {formatCurrency(value, currency)}
    </Typography>
  </Box>
);

export const SignatoriesCell = ({ signatories }) => {
  if (!signatories || signatories.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        No signatories
      </Typography>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
      {signatories.slice(0, 2).map((sig, idx) => (
        <Box key={idx} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <PersonOutlined sx={{ fontSize: 12, color: 'text.secondary' }} />
          <Typography variant="body2" noWrap>
            {sig.name}
          </Typography>
        </Box>
      ))}
      {signatories.length > 2 && (
        <Typography variant="caption" color="text.secondary">
          +{signatories.length - 2} more
        </Typography>
      )}
    </Box>
  );
};

export const DateCell = ({ date }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
    <CalendarTodayOutlined sx={{ fontSize: 14, color: 'text.secondary' }} />
    <Typography variant="body2">
      {formatDate(date)}
    </Typography>
  </Box>
);

export const RiskCell = ({ score }) => (
  <Chip
    label={getRiskLabel(score)}
    size="small"
    color={getRiskColor(score)}
    variant="outlined"
    sx={{ 
      fontWeight: 500,
      borderWidth: 1.5,
    }}
  />
);

export const ConfidenceCell = ({ score }) => (
  <Chip
    label={`${Math.round(score * 100)}%`}
    size="small"
    color={getConfidenceColor(score)}
    variant="outlined"
    sx={{ 
      fontWeight: 500,
      borderWidth: 1.5,
    }}
  />
);

export const StatusCell = ({ needsReview }) => (
  needsReview ? (
    <Chip
      icon={<WarningAmberOutlined fontSize="small" />}
      label="Needs Review"
      size="small"
      color="warning"
      sx={{ fontWeight: 500 }}
    />
  ) : (
    <Chip
      icon={<CheckCircleOutlined fontSize="small" />}
      label="Reviewed"
      size="small"
      color="success"
      sx={{ fontWeight: 500 }}
    />
  )
);

export const ActionButtons = ({ 
  contract, 
  onView, 
  onCompare, 
  isSelectedForCompare 
}) => (
  <Box sx={{ display: 'flex', gap: 0.5 }}>
    <Tooltip title="View details">
      <IconButton
        size="small"
        onClick={() => onView?.(contract)}
        sx={{ 
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 2,
          p: 0.75,
        }}
      >
        <VisibilityOutlined fontSize="small" />
      </IconButton>
    </Tooltip>
    
    <Tooltip title={isSelectedForCompare ? "Selected for comparison" : "Compare contract"}>
      <IconButton
        size="small"
        onClick={() => onCompare?.(contract)}
        sx={{ 
          border: '1px solid',
          borderColor: isSelectedForCompare ? 'primary.main' : 'divider',
          borderRadius: 2,
          p: 0.75,
          color: isSelectedForCompare ? 'primary.main' : 'inherit',
          backgroundColor: isSelectedForCompare ? 'primary.50' : 'transparent',
        }}
      >
        <CompareOutlined fontSize="small" />
      </IconButton>
    </Tooltip>
  </Box>
);