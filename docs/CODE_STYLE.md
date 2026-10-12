# Code style (the rules we follow)
1. Every file starts with "WHAT THIS FILE DOES".
2. One file, one job.
3. Names are plain words: `colonistWalkSpeed`, not `cws`.
4. Comments explain WHY, not just what.
5. Numbers you might change go in src/config.ts, never buried in code.
6. Small functions that do one thing.
7. Sim never imports Babylon.
8. Run `npm run format` before committing.
