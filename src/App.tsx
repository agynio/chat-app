import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Navigate, Route, Routes } from 'react-router-dom';
import { TemplatesProvider as RuntimeTemplatesProvider } from './lib/graph/templates.provider';
import { TooltipProvider } from './components/ui/tooltip';
import { RootLayout } from './layout/RootLayout';
import { AgentsChat } from './pages/AgentsChat';
import { AgentsThreads } from './pages/AgentsThreads';

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RuntimeTemplatesProvider>
        <TooltipProvider delayDuration={200}>
          <Routes>
            <Route path="/" element={<Navigate to="/agents/threads" replace />} />

            <Route element={<RootLayout />}>
              <Route path="/agents" element={<Navigate to="/agents/threads" replace />} />
              <Route path="/agents/chat" element={<AgentsChat />} />
              <Route path="/agents/threads" element={<AgentsThreads />} />
              <Route path="/agents/threads/:threadId" element={<AgentsThreads />} />
            </Route>

            <Route path="*" element={<Navigate to="/agents/threads" replace />} />
          </Routes>
        </TooltipProvider>
      </RuntimeTemplatesProvider>
    </QueryClientProvider>
  );
}

export default App;
