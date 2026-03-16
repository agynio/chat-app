import { useCallback } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { MessageSquare } from 'lucide-react';
import { MainLayout } from '@/components/layouts/MainLayout';
import type { MenuItem } from '@/components/Sidebar';

const MENU_ITEM_ROUTES: Record<string, string> = {
  agentsThreads: '/agents/threads',
};

const MENU_ITEMS: MenuItem[] = [
  {
    id: 'agents',
    label: 'Chat',
    icon: <MessageSquare className="w-5 h-5" />,
    items: [
      { id: 'agentsThreads', label: 'Threads', icon: <MessageSquare className="w-4 h-4" /> },
    ],
  },
];

const DEFAULT_MENU_ITEM = 'agentsThreads';
const MENU_ITEM_ENTRIES = Object.entries(MENU_ITEM_ROUTES);

function matchesRoute(pathname: string, route: string) {
  if (route === '/') {
    return pathname === '/';
  }
  return pathname === route || pathname.startsWith(`${route}/`);
}

function getMenuItemFromPath(pathname: string) {
  let matched = DEFAULT_MENU_ITEM;
  let bestLength = 0;
  for (const [itemId, route] of MENU_ITEM_ENTRIES) {
    if (matchesRoute(pathname, route) && route.length > bestLength) {
      matched = itemId;
      bestLength = route.length;
    }
  }
  return matched;
}

export function RootLayout() {
  const location = useLocation();
  const navigate = useNavigate();

  const selectedMenuItem = getMenuItemFromPath(location.pathname);

  const handleMenuItemSelect = useCallback(
    (itemId: string) => {
      const targetPath = MENU_ITEM_ROUTES[itemId];
      if (!targetPath) return;

      if (location.pathname !== targetPath) {
        navigate(targetPath);
      }
    },
    [location.pathname, navigate],
  );

  return (
    <MainLayout
      menuItems={MENU_ITEMS}
      selectedMenuItem={selectedMenuItem}
      onMenuItemSelect={handleMenuItemSelect}
    >
      <Outlet />
    </MainLayout>
  );
}
