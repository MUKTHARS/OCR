export const getRiskColor = (score) => {
  if (score >= 0.7) return 'error';
  if (score >= 0.3) return 'warning';
  return 'success';
};

export const getRiskLabel = (score) => {
  if (score >= 0.7) return 'High Risk';
  if (score >= 0.3) return 'Medium Risk';
  return 'Low Risk';
};

export const getConfidenceColor = (score) => {
  if (score >= 0.9) return 'success';
  if (score >= 0.7) return 'warning';
  return 'error';
};

export const getSeverityColor = (severity) => {
  const colors = {
    critical: 'error',
    high: 'error',
    medium: 'warning',
    low: 'success',
  };
  return colors[severity?.toLowerCase()] || 'default';
};

export const formatDate = (dateString) => {
  if (!dateString) return 'Not specified';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric',
  }) + ' • ' + date.toLocaleTimeString('en-US', { 
    hour: '2-digit', 
    minute: '2-digit' 
  });
};

export const formatRelativeDate = (dateString) => {
  if (!dateString) return 'Not specified';
  const date = new Date(dateString);
  const now = new Date();
  const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return formatDate(dateString);
};

export const formatCurrency = (value, currency = 'USD') => {
  if (!value && value !== 0) return 'N/A';
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  return formatter.format(value);
};

export const formatPercentage = (value) => {
  if (value === null || value === undefined) return 'N/A';
  return `${(value * 100).toFixed(1)}%`;
};