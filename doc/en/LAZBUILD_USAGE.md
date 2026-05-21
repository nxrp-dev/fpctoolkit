# Lazbuild Usage Guide

Nexus Pascal builds Lazarus projects with `lazbuild`.

## Overview

When building a Lazarus project (`.lpi` or `.lpk`), the extension uses `lazbuild` and passes the selected build mode. FPC remains available through dedicated FPC tasks for non-Lazarus projects.

## Lazbuild Detection

The extension detects `lazbuild` in the following order:

1. Check if `lazbuild` is available in system PATH
2. Check common installation paths:
   - **Windows**: `C:\lazarus\lazbuild.exe`, `C:\Program Files\Lazarus\lazbuild.exe`
   - **macOS**: `/usr/local/bin/lazbuild`, `/Applications/Lazarus/lazbuild`
   - **Linux**: `/usr/bin/lazbuild`, `/usr/local/bin/lazbuild`
3. Check `LAZARUSDIR` environment variable or `nexusPascal.env.LAZARUSDIR` setting

## Build Modes

When using `lazbuild`, the extension:

- Passes the selected build mode using `--build-mode=<mode>`
- Uses `--build-all` for rebuild operations
- Adds `--quiet` to reduce output noise

## Troubleshooting

If `lazbuild` is not detected:

1. Ensure Lazarus is installed
2. Add the Lazarus installation directory to your system PATH
3. Set the `LAZARUSDIR` environment variable
4. Configure `nexusPascal.env.LAZARUSDIR` in VS Code settings
