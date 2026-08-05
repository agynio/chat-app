import { useMemo } from 'react';
import { ChevronsUpDown, LogOut } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { cn } from './ui/utils';
import { useTheme } from './theme-provider';
import { useUser } from '@/user/user.runtime';
import { useOrganization } from '@/organization/organization.runtime';
import { oidcConfig } from '@/config';
import { LogoutButton } from '@/auth/LogoutButton';

const THEME_OPTIONS = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
] as const;

function getInitials(name: string | null | undefined): string {
  if (!name) return 'U';
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const second = parts[1]?.[0] ?? '';
  return `${first}${second}`.toUpperCase() || 'U';
}

export function SidebarUserMenu({
  className,
  side = 'top',
}: {
  className?: string;
  /** Menus anchored outside a sidebar footer open downward. */
  side?: 'top' | 'bottom';
}) {
  const { user } = useUser();
  const { organizations, selectedOrganizationId, selectOrganization } = useOrganization();
  const { theme, setTheme } = useTheme();

  const userInitials = useMemo(() => getInitials(user?.name ?? user?.email), [user?.name, user?.email]);
  const currentOrganization = useMemo(
    () => organizations.find((org) => org.id === selectedOrganizationId) ?? organizations[0] ?? null,
    [organizations, selectedOrganizationId],
  );
  const themeLabel = THEME_OPTIONS.find((option) => option.value === theme)?.label ?? 'System';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            'flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left transition-colors hover:bg-muted',
            className,
          )}
          data-testid="user-menu-trigger"
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
            {userInitials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-foreground" title={user?.email ?? undefined}>
              {user?.email ?? user?.name ?? 'Signed in'}
            </p>
            <p className="truncate text-xs text-muted-foreground" data-testid="current-org-name">
              {currentOrganization?.name ?? 'No organization'}
            </p>
          </div>
          <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side={side}
        align="start"
        className="w-(--radix-dropdown-menu-trigger-width) min-w-56"
      >
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Organization</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={selectedOrganizationId ?? ''}
          onValueChange={(value) => selectOrganization(value)}
          data-testid="org-switcher"
        >
          {organizations.map((organization) => (
            <DropdownMenuRadioItem
              key={organization.id}
              value={organization.id}
              className="data-[state=checked]:font-medium"
              data-testid={`org-item-${organization.id}`}
            >
              <span className="truncate" title={organization.name}>
                {organization.name}
              </span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuSub>
          <DropdownMenuSubTrigger data-testid="theme-menu-trigger">
            <span className="flex-1">Theme</span>
            <span className="text-muted-foreground">{themeLabel}</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuRadioGroup value={theme} onValueChange={(value) => setTheme(value as typeof theme)}>
              {THEME_OPTIONS.map((option) => (
                <DropdownMenuRadioItem
                  key={option.value}
                  value={option.value}
                  data-testid={`theme-${option.value}`}
                >
                  {option.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        {oidcConfig.enabled ? (
          <DropdownMenuItem asChild>
            <LogoutButton className="w-full">
              <LogOut className="h-4 w-4 text-muted-foreground" />
              <span>Sign out</span>
            </LogoutButton>
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem disabled>
            <LogOut className="h-4 w-4 text-muted-foreground" />
            <span>Sign out</span>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
