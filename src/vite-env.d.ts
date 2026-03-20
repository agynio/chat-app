/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_OIDC_AUTHORITY?: string;
  readonly VITE_OIDC_CLIENT_ID?: string;
  readonly VITE_OIDC_REDIRECT_URI?: string;
  readonly VITE_OIDC_POST_LOGOUT_REDIRECT_URI?: string;
  readonly VITE_OIDC_SCOPE?: string;
  readonly VITE_UI_MOCK_SIDEBAR?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface Window {
  __APP_CONFIG?: {
    API_BASE_URL?: string;
    OIDC_AUTHORITY?: string;
    OIDC_CLIENT_ID?: string;
    OIDC_REDIRECT_URI?: string;
    OIDC_POST_LOGOUT_REDIRECT_URI?: string;
    OIDC_SCOPE?: string;
  };
}
