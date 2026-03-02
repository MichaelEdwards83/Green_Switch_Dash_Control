# Switch Control Dashboard

A unified, high-performance network infrastructure dashboard designed for managing and monitoring Green Network switches and devices.

## Features

- **Global Overview**: Fast TCP-ping based monitoring of all network devices (servers, players, switches).
- **Interactive Switch Faceplates**: Deep-dive management of Netgear M4300 series switches.
- **VLAN Management**: Assign and track VLANs directly from the visual faceplate.
- **PoE Control**: Cycle Power over Ethernet for individual ports.
- **High Contrast Theme**: Toggle between dark and high-contrast light modes for better readability.
- **Cross-Platform**: Runs on Windows and macOS (Intel & Apple Silicon).

## Project Structure

```text
/
├── bin/                # Pre-packaged standalone executables
├── src/                # React Frontend source
├── server.js           # Node.js Express Backend
├── devices.json        # Configuration for network devices
├── .env.example        # Template for switch credentials
└── build_executables.js # Script to bundle everything into a single binary
```

## Getting Started (Development)

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Configure Devices**:
   Edit `devices.json` to include your network devices.

3. **Set Credentials**:
   Copy `.env.example` to `.env` and fill in your switch username and password.

4. **Run Dev Server**:
   ```bash
   npm run dev
   ```
   Access the dashboard at `http://localhost:5173`.

## Deployment (Headless Server)

To run the application as a background service without needing Node.js installed:

1. Navigate to the `bin/` directory for your operating system.
2. Ensure `devices.json` and `.env` are present in the same folder as the executable.
3. Run the `SwitchDash` executable.
4. Access the dashboard from any browser on the network at `http://<machine-ip>:3002`.

## Building from Source

To generate new standalone binaries:
```bash
node build_executables.js
```
This requires `npm install` to have been run first.

## Technical Details

- **Frontend**: React, Vite, Lucide-React, Tailwind-less custom CSS.
- **Backend**: Node.js, Express, Axios (with custom HTTPS agent for legacy switch support).
- **Bundling**: `esbuild` for CJS transpilation and `pkg` for native binary packaging.

---
Created with ❤️ for the Green Network team.
