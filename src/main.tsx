import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthGate } from '@/auth';
import { registerMediaServiceWorker } from '@/lib/media/sw-registration';
import App from './App';
import './index.css';
import { UserProvider } from './user/UserProvider';
import { OrganizationProvider } from './organization/OrganizationProvider';

const queryClient = new QueryClient();
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <AuthGate>
          <UserProvider>
            <OrganizationProvider>
              <App />
            </OrganizationProvider>
          </UserProvider>
        </AuthGate>
      </QueryClientProvider>
    </BrowserRouter>
  </StrictMode>,
);

void registerMediaServiceWorker();
