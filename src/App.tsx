import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Navigate, Route, Routes } from 'react-router-dom';
import { TemplatesProvider as RuntimeTemplatesProvider } from './lib/graph/templates.provider';
import { TooltipProvider } from './components/ui/tooltip';
import { RootLayout } from './layout/RootLayout';
import { Conversations } from './pages/Conversations';

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RuntimeTemplatesProvider>
        <TooltipProvider delayDuration={200}>
          <Routes>
            <Route path="/" element={<Navigate to="/conversations" replace />} />

            <Route element={<RootLayout />}>
              <Route path="/conversations" element={<Conversations />} />
              <Route path="/conversations/:conversationId" element={<Conversations />} />
            </Route>

            <Route path="*" element={<Navigate to="/conversations" replace />} />
          </Routes>
        </TooltipProvider>
      </RuntimeTemplatesProvider>
    </QueryClientProvider>
  );
}

export default App;
