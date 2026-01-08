export const fileTypes = {
  pdf: 'application/pdf',
  word: 'application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

export const getFileType = (file) => {
  if (file.type.includes('pdf')) return 'PDF';
  if (file.type.includes('word') || file.name.endsWith('.doc') || file.name.endsWith('.docx')) return 'Word';
  return 'Document';
};

export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const amendmentTypes = [
  { value: 'modification', label: 'Modification' },
  { value: 'renewal', label: 'Renewal' },
  { value: 'extension', label: 'Extension' },
  { value: 'termination', label: 'Termination' },
  { value: 'correction', label: 'Correction' },
  { value: 'addendum', label: 'Addendum' },
];

export const processingStages = [
  { id: 1, label: 'Uploading document', description: 'Sending file to server' },
  { id: 2, label: 'Extracting text', description: 'Reading document content' },
  { id: 3, label: 'Processing chunks', description: 'Analyzing document sections with AI' },
  { id: 4, label: 'AI Analysis', description: 'Extracting contract details' },
  { id: 5, label: 'Extracting clauses', description: 'Identifying legal terms' },
  { id: 6, label: 'Calculating risk', description: 'Analyzing risk factors' },
  { id: 7, label: 'Creating embeddings', description: 'Preparing for search' },
  { id: 8, label: 'Saving to database', description: 'Storing extracted data' },
  { id: 9, label: 'Final verification', description: 'Validating extracted data' },
  { id: 10, label: 'Processing complete', description: 'Ready for review' },
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