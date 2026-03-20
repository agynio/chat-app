import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthGate } from '@/auth';
import App from './App';
import './index.css';
import { UserProvider } from './user/UserProvider';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthGate>
        <UserProvider>
          <App />
        </UserProvider>
      </AuthGate>
    </BrowserRouter>
  </StrictMode>,
);
