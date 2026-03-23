import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import { TemplatesProvider as RuntimeTemplatesProvider } from './lib/graph/templates.provider';
import { TooltipProvider } from './components/ui/tooltip';
import { RootLayout } from './layout/RootLayout';
import { Chats } from './pages/Chats';

const queryClient = new QueryClient();

function ChatRouteRedirect() {
  const { chatId } = useParams<{ chatId?: string }>();
  const target = chatId ? `/chats/${encodeURIComponent(chatId)}` : '/chats';
  return <Navigate to={target} replace />;
}

function App() {

  return (
    <QueryClientProvider client={queryClient}>
      <RuntimeTemplatesProvider>
        <TooltipProvider delayDuration={200}>
          <Routes>
            <Route path="/" element={<Navigate to="/chats" replace />} />

            <Route element={<RootLayout />}>
              <Route path="/conversations" element={<ChatRouteRedirect />} />
              <Route path="/conversations/:chatId" element={<ChatRouteRedirect />} />
              <Route path="/chats" element={<Chats />} />
              <Route path="/chats/:chatId" element={<Chats />} />
            </Route>

            <Route path="*" element={<Navigate to="/chats" replace />} />
          </Routes>
        </TooltipProvider>
      </RuntimeTemplatesProvider>
    </QueryClientProvider>
  );
}

export default App;
