# callio

> Clear, private video calls in the browser - no account required.

Callio is a lightweight peer-to-peer video calling application built with React, TypeScript, Vite, and WebRTC. Create a room, share the short room code, and start talking without installing an app or creating an account.

## Highlights

- **Instant rooms** - create a room in seconds with a generated six-character code.
- **Peer-to-peer media** - audio and video are exchanged directly between participants through WebRTC.
- **No account required** - Callio does not require registration or a user database.
- **Essential call controls** - mute/unmute, camera on/off, camera switching, and leave-call controls.
- **Responsive by design** - works across desktop, tablet, and mobile layouts.
- **Connection resilience** - signaling and peer-connection recovery are handled by the call hook.
- **NAT traversal support** - includes Google STUN and optional TURN configuration for restrictive networks.
- **Accessible controls** - buttons include labels and titles, and the interface supports keyboard-friendly form actions.

## How it works

Callio uses three browser and network primitives:

1. **WebSocket signaling** exchanges room membership, SDP offers/answers, ICE candidates, and media-state updates.
2. **WebRTC** establishes the media connection between the two browsers.
3. **STUN/TURN servers** help browsers discover and reach each other across NATs and firewalls.

The signaling service is configured in [`src/constants/call.ts`](./src/constants/call.ts). The default endpoint is:

```text
wss://api.imranlab.tech/v1/call/ws
```

The application is the client only; the signaling server is not included in this repository.

## Requirements

- Node.js 20 or newer
- npm 10 or newer
- A modern browser with WebRTC support
- Camera and microphone access
- HTTPS in production (required by browsers for `getUserMedia`, except on localhost)

## Getting started

### 1. Clone the repository

```bash
git clone https://github.com/ImranAvenger/callio.git
cd callio
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a local environment file:

```bash
cp .env.example .env
```

The default Google STUN server is already configured in the application. Add TURN credentials when calls must work reliably across restrictive NATs, corporate networks, or separate networks:

```env
VITE_TURN_URLS=turn:your-turn-host:3478,turns:your-turn-host:5349
VITE_TURN_USERNAME=your-username
VITE_TURN_CREDENTIAL=your-credential
```

`VITE_TURN_URLS` accepts a comma-separated list. Never commit real TURN credentials to the repository.

### 4. Start the development server

```bash
npm run dev
```

Open the local URL printed by Vite, usually [`http://localhost:5173`](http://localhost:5173).

### 5. Try a call

1. Enter your name.
2. Select **Start a new call**.
3. Copy the room code or room link.
4. Open the link in another browser or device.
5. Enter the second participant's name and join.
6. Allow camera and microphone access when prompted.

## Available scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite development server with hot reload |
| `npm run build` | Type-check and create the production build in `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | Run ESLint across the project |

Before opening a pull request, run:

```bash
npm run build
npm run lint
```

## Project structure

```text
callio/
├── public/
│   ├── favicon.svg       # Browser favicon
│   └── icons.svg         # Static SVG symbols
├── src/
│   ├── constants/
│   │   └── call.ts       # Signaling URL, ICE servers, shared styles
│   ├── hooks/
│   │   └── useCall.ts    # WebSocket and WebRTC call lifecycle
│   ├── types/
│   │   └── call.ts       # Signaling and call state types
│   ├── App.tsx           # Lobby, call screen, controls, and layout
│   ├── index.css         # Tailwind theme and global styles
│   └── main.tsx          # React application entry point
├── .env.example          # TURN configuration template
├── index.html             # HTML shell and metadata
└── package.json           # Scripts and dependencies
```

## Architecture notes

### Call lifecycle

- `useCall` owns room state, connection state, media tracks, and cleanup.
- The lobby validates the display name and room code before connecting.
- A room creator and a room joiner negotiate a WebRTC peer connection through the signaling channel.
- Local and remote streams are attached to video elements through refs.
- Media state is synchronized so participants can see when a camera is disabled.
- Leaving a call closes the WebSocket, stops local media tracks, and releases the peer connection.

### Room links

Callio accepts a room code through the `room` query parameter:

```text
https://your-domain.example/?room=ABC123
```

The room code is not an access-control mechanism. Anyone with the code or link can attempt to join while the room is available. Share links only with intended participants.

## Deployment

Build the static client:

```bash
npm run build
```

Deploy the generated `dist/` directory to any static hosting provider that supports single-page applications, such as Cloudflare Pages, Netlify, Vercel, GitHub Pages, or an object-storage CDN.

For production:

- Serve the site over HTTPS.
- Configure the host to fall back to `index.html` for client-side routes.
- Provide `VITE_TURN_*` variables through the hosting provider when TURN is needed.
- Confirm that the deployed origin can connect to the configured `wss://` signaling endpoint.
- Make sure camera and microphone permissions are allowed for the deployed origin.

## Troubleshooting

### The browser cannot access the camera or microphone

- Use HTTPS or `localhost`.
- Check the browser's site permissions.
- Close other applications currently using the camera.
- Verify that the selected device is available to the operating system.

### The call connects but media never starts

- Confirm both participants allowed camera and microphone permissions.
- Check that the signaling WebSocket endpoint is reachable.
- Configure a working TURN server for restrictive networks.
- Test both participants from a different network, such as a mobile hotspot.

### Calls fail across different networks

STUN is often enough for simple NATs, but it cannot relay media. Configure TURN credentials in `.env` and rebuild the application so WebRTC can use a relay when a direct connection is not possible.

## Security and privacy

- Media is negotiated with WebRTC and is intended to travel peer-to-peer whenever possible.
- TURN servers can relay encrypted WebRTC traffic when a direct route is unavailable.
- The room code should be treated as shareable access information.
- Do not expose TURN passwords in source control.
- Review and secure the signaling service before deploying Callio for sensitive use cases.

## Contributing

1. Create a focused branch from the default branch.
2. Keep changes small and explain behavior changes clearly.
3. Follow the existing TypeScript and Tailwind conventions.
4. Run the build and lint scripts before submitting a pull request.
5. Include reproduction steps for bug fixes and screenshots for meaningful UI changes.

## License

No license file is currently included. If you plan to redistribute or modify Callio, contact the repository owner before treating the project as open-source software.

## Author

Built by [ImranAvenger](https://github.com/ImranAvenger).

If Callio is useful to you, consider starring the repository or opening an issue with feedback.
