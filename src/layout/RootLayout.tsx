import { Outlet } from 'react-router-dom';

export function RootLayout() {
  return (
    <div className="h-screen bg-[var(--agyn-bg-light)] flex">
      <div className="flex-1 flex min-w-0 flex-col overflow-hidden">
        <Outlet />
      </div>
    </div>
  );
}
