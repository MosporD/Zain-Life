/* Microsoft sign-in settings. Paste the "Application (client) ID" of the Entra app registration here.
   Test build: your own registration, tenant 'common' (work, school and personal Microsoft accounts).
   Zain build: Zain IT's registration, tenant = Zain's tenant ID (only Zain accounts can then sign in).
   The registration needs the redirect URI below under "Mobile and desktop applications", and the
   delegated Microsoft Graph permission User.Read. Leave clientId empty to hide sign-in. */
window.ZL_MS_CONFIG = {
  clientId: '',
  tenant: 'common',
  redirectUri: 'com.zainlife.app://auth',
  scopes: 'openid profile email User.Read'
};
