import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import { App } from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import '@fontsource/onest/400.css';
import '@fontsource/onest/500.css';
import '@fontsource/onest/600.css';
import '@fontsource/onest/700.css';
import './styles.css';

const rootEl = document.getElementById('root');
if (!rootEl) {
  throw new Error('root element missing');
}
createRoot(rootEl).render(
  <StrictMode>
    <ThemeProvider>
      <ToastProvider>
<BrowserRouter>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </BrowserRouter>
      </ToastProvider>
    </ThemeProvider>
  </StrictMode>,
);