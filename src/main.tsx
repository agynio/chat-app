import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthGate } from '@/auth';
import App from './App';
import './index.css';
import { UserProvider } from './user/UserProvider';

const queryClient = new QueryClient();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <AuthGate>
          <UserProvider>
            <App />
          </UserProvider>
        </AuthGate>
      </QueryClientProvider>
    </BrowserRouter>
  </StrictMode>,
);
