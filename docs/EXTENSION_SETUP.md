# Chrome Extension Setup

## Environment Variable Configuration

To use the LinkedIn sync functionality, you need to configure your Chrome extension ID in your environment variables.

### 1. Get Your Extension ID

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top-right)
3. Find your "YALG - LinkedIn Post Sync" extension
4. Copy the Extension ID (a 32-character string like `abcdefghijklmnopqrstuvwxyz123456`)

### 2. Configure Environment Variable

Add the following to your `.env.local` file in the frontend directory:

```bash
# Chrome Extension Configuration
NEXT_PUBLIC_CHROME_EXTENSION_ID=abcdefghijklmnopqrstuvwxyz123456
```

### 3. Restart Development Server

After adding the environment variable, restart your Next.js development server:

```bash
npm run dev
# or
yarn dev
```

### 4. Verify Setup

1. Go to your Settings page
2. Navigate to the LinkedIn Integration section
3. You should see "Extension Connected" if everything is configured correctly

## Troubleshooting

- **Extension Not Found**: Make sure the extension is installed and enabled in Chrome
- **Extension ID Not Configured**: Check that your `.env.local` file has the correct variable name
- **Chrome APIs Not Available**: Make sure you're using Chrome browser (not Firefox/Safari)

## Production Deployment

For production deployments, make sure to set the `NEXT_PUBLIC_CHROME_EXTENSION_ID` environment variable in your hosting platform's environment configuration. 