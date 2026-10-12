# 3D Colony
Babylon.js colony game, built to a single offline index.html (works on file://).
Sim (src/sim) is kept separate from rendering (src/render).

## Commands
| Command                     | What it does                                              |
|-----------------------------|-----------------------------------------------------------|
| `npm run dev`               | Start the game while you work (open it from the Ports tab) |
| `npm run check`             | Look for mistakes                                         |
| `npm run format`            | Tidy all the code                                         |
| `npm run build`             | Make the single offline file at `dist/index.html`         |
| `npm run check && npm run build` | Check, then build                                    |

## Making the offline file
1. `rm -rf dist && npm run check && npm run build`
2. `ls -lh dist` should show ONE file: `index.html`
3. Right-click `dist/index.html` in the Explorer, then Download.
4. Double-click it on your laptop. No server needed.
5. If something is missing, open the browser console (F12) and look for red errors.
