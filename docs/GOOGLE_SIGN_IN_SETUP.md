# Google sign-in setup

Chatty uses Google Identity Services in the browser and verifies every Google ID token in the
backend before creating the existing Chatty session cookie.

## Configure Google Cloud

1. Open the [Google Auth Platform](https://console.cloud.google.com/auth/overview) and configure
   the OAuth consent screen for the project.
2. Create an OAuth client with the **Web application** type.
3. Add the sites that can open Chatty under **Authorized JavaScript origins**. For local
   development, add both `http://localhost:5173` and `http://127.0.0.1:5173`. Add the live HTTPS
   origin for production, such as `https://chat.example.com`.
4. Copy the generated client ID. A client secret is not used by this sign-in flow.

Google's current setup guide is available at
[developers.google.com/identity/gsi/web/guides/get-google-api-clientid](https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid).

## Configure Chatty

Add the web client ID to `backend/.env`:

```env
GOOGLE_CLIENT_ID=your-web-client-id.apps.googleusercontent.com
```

Restart the backend after changing the environment. The login and signup pages will then render
Google's official **Continue with Google** button. New Google users are created automatically.
Existing Gmail and Google Workspace users are safely linked when the verified email matches.
