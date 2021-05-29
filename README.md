# impression-tracker-react-hook

This library is used to track impressions using a react useImpressionTracker hook.

## Features



Uses
- [TypeScript](https://www.typescriptlang.org/) support
- [React](https://reactjs.org/) support
- CSS Modules with [PostCSS](https://postcss.org/)
- [ESLint](https://eslint.org/) (with [React](https://reactjs.org/) and [Prettier](https://prettier.io/))
- Unit tests ([Jest](https://jestjs.io/) and [Testing Library](https://testing-library.com/))
- Minified output with [Terser](https://terser.org/)
- Bundle size validation with [size-limit](https://github.com/ai/size-limit)
- Flexible builds with [Rollup](https://www.rollupjs.org/)
- [CHANGELOG.md](https://keepachangelog.com/en/1.0.0/) template

## Scripts

- Run most commands: `npm run finish`
- Build the project: `npm run build`
  - Validate output bundle size with `npm run size`
- Lint the project: `npm run lint`
- Run unit tests: `npm test` or `npm test`


## When developing locally

**Broken** - This fails with a `Error: Cannot find module 'react'` when using with NextJS.

If you want to test local changes in an actual deployment, use `npm link`.

1. Run `npm run updateLink`.
4. Go to client directory and run `npm link impression-tracker-react-hook`.

When you update `impression-tracker-react-hook`, run `npm run updateLink`.

When you want to undo, use `npm unlink` in `impression-tracker-react-hook/dist` and `npm unlink impression-tracker-react-hook` in the client directory.

## Deploy

We use a GitHub action that runs semantic-release to determine how to update versions.  Just do a normal code review and this should work.  Depending on the message prefixes (e.g. `feat: `, `fix: `, `clean: `, `docs: `), it'll update the version appropriately.

When doing a breaking change, add `BREAKING CHANGE:` to the PR.  The colon is important.

# Resources

The base of this repository is a combination of the following repos:
- https://github.com/DenysVuika/react-lib
- https://github.com/Alexandrshy/como-north and https://dev.to/alexandrshy/creating-a-template-repository-in-github-1d05
