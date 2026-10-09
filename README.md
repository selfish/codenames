# Codenames Random Map Card Generator

### https://codenames.nit.ai

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in your browser.

The page will reload when you make changes.\
You may also see any lint errors in the console.

## Verification

Use Node 20, matching the GitHub Actions build and deployment workflows:

```sh
npm ci
npm run lint
npm run typecheck
npm run test:ci
CI=true npm run build
```
