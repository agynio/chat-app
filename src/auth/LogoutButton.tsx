import type { ButtonHTMLAttributes } from 'react';
import { useAuth } from 'react-oidc-context';
import { oidcConfig } from '@/config';
import { signOut } from './sign-out';

type LogoutButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;

function OidcLogoutButton({ children = 'Sign out', onClick, type = 'button', ...rest }: LogoutButtonProps) {
  const auth = useAuth();

  const handleClick: LogoutButtonProps['onClick'] = (event) => {
    onClick?.(event);
    if (event?.defaultPrevented) return;
    void signOut(auth);
  };

  return (
    <button type={type} onClick={handleClick} {...rest}>
      {children}
    </button>
  );
}

export function LogoutButton(props: LogoutButtonProps) {
  if (!oidcConfig.enabled) return null;
  return <OidcLogoutButton {...props} />;
}
