# Nexus Notes

This repository is a Nexus fork of `coolchyni/fpctoolkit`, the FreePascal
Toolkit extension for VS Code.

Current intent:

- Keep the fork close to upstream until Nexus needs a specific fix.
- Use this checkout for reading, debugging, and controlled local changes.
- Make changes one step at a time, with verification before moving on.

Current status:

- No Nexus source patches have been made.
- No extension package is installed from this checkout.
- Build outputs and dependency folders should not be committed.

Generated folders to keep out of source control:

- `node_modules/`
- `out/`
- `dist/`
- `*.vsix`
