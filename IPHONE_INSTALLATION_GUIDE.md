# iPhone Installation Guide

## Status

Real iPhone installation is `BLOCKED` until a public HTTPS URL is deployed on Render/Railway or another Node.js host.

The app metadata is prepared:

- App name: Franklin Research
- Version: 10.0.0
- Display mode: standalone
- Theme color: `#08131F`
- Apple touch icon: `public/assets/apple-touch-icon.png`
- Manifest icons: `192x192` and `512x512`

## Install After Deployment

1. Open the production HTTPS link in iPhone Safari.
2. Enter the private access password.
3. Tap the Safari Share button.
4. Tap `Add to Home Screen`.
5. Confirm the name `Franklin Research`.
6. Launch the app from the new icon.

## Expected Behavior

- The app opens in standalone mode.
- The approved coin icon appears on the Home Screen.
- The login screen appears before the platform if the session is not active.
- API keys are never entered on the phone.
- Search and parser calls go through the private backend.
- Offline state does not show stale prices as current data.

## If The Old Icon Appears

Delete the old Home Screen shortcut, reopen the HTTPS URL in Safari, and add it again. iOS may cache old icons.

