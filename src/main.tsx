import { Fragment, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthGate } from '@/auth';
import { registerMediaServiceWorker } from '@/lib/media/sw-registration';
import { isE2eMockEnabled } from '@/lib/e2e/identity';
import App from './App';
import './index.css';
import { UserProvider } from './user/UserProvider';
import { OrganizationProvider } from './organization/OrganizationProvider';

const queryClient = new QueryClient();
const RootWrapper = isE2eMockEnabled() ? Fragment : StrictMode;

createRoot(document.getElementById('root')!).render(
  <RootWrapper>
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
  </RootWrapper>,
);

void registerMediaServiceWorker();
