export const amendmentTypes = [
  { value: 'modification', label: 'Modification' },
  { value: 'renewal', label: 'Renewal' },
  { value: 'extension', label: 'Extension' },
  { value: 'termination', label: 'Termination' },
  { value: 'correction', label: 'Correction' },
  { value: 'addendum', label: 'Addendum' },
];

export const getStatusIcon = (status) => {
  switch (status) {
    case 'completed':
      return { icon: '✓', color: 'success.main' };
    case 'processing':
      return { icon: '⟳', color: 'primary.main' };
    case 'error':
      return { icon: '✗', color: 'error.main' };
    case 'uploading':
      return { icon: '⬆', color: 'info.main' };
    default:
      return { icon: '⋯', color: 'text.disabled' };
  }
};

export const getStatusColor = (status) => {
  switch (status) {
    case 'completed':
      return 'success';
    case 'processing':
      return 'primary';
    case 'error':
      return 'error';
    case 'uploading':
      return 'info';
    default:
      return 'default';
  }
};

export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};