import { createTheme } from '@mui/material/styles';

const amendmentUploadTheme = createTheme({
  palette: {
    primary: {
      main: '#1a237e',
      light: '#534bae',
      dark: '#000051',
    },
    secondary: {
      main: '#546e7a',
      light: '#819ca9',
      dark: '#29434e',
    },
    background: {
      default: '#f8f9fa',
      paper: '#ffffff',
    },
    text: {
      primary: '#212121',
      secondary: '#546e7a',
    },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", sans-serif',
    h6: {
      fontWeight: 600,
      fontSize: '1.125rem',
    },
    subtitle1: {
      fontWeight: 500,
      fontSize: '1rem',
    },
    body1: {
      fontSize: '0.9375rem',
      lineHeight: 1.6,
    },
    body2: {
      fontSize: '0.875rem',
      lineHeight: 1.57,
    },
    caption: {
      fontSize: '0.75rem',
    },
  },
  components: {
    MuiStepper: {
      styleOverrides: {
        root: {
          padding: 0,
        },
      },
    },
    MuiStep: {
      styleOverrides: {
        root: {
          padding: 0,
        },
      },
    },
    MuiStepContent: {
      styleOverrides: {
        root: {
          borderLeft: '2px solid #e0e0e0',
          marginLeft: 12,
          paddingLeft: 24,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
          border: '1px solid #e0e0e0',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 8,
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 6,
          textTransform: 'none',
          fontWeight: 500,
        },
        contained: {
          boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
          '&:hover': {
            boxShadow: '0 2px 4px rgba(0,0,0,0.12)',
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 4,
          fontWeight: 500,
          fontSize: '0.75rem',
          height: 24,
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: 6,
          border: '1px solid',
        },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: {
          borderRadius: 4,
          height: 6,
        },
      },
    },
  },
});

export default amendmentUploadTheme;