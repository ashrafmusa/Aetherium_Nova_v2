# Contributing to Aetherium Nova

Thank you for your interest in contributing. This document explains how to get involved.

---

## Ways to Contribute

- **Bug reports** — open an issue using the bug report template
- **Feature proposals** — open an issue using the feature request template
- **Code contributions** — fork, branch, and open a pull request
- **Documentation** — improve the README, add inline comments, or write guides
- **Testing** — run the testnet, report sync or consensus edge cases

---

## Development Setup

```bash
git clone https://github.com/ashrafmusa/Aetherium_Nova_v2.git
cd Aetherium_Nova_v2
npm install
npm run build
API_KEY=dev-key node dist/node.js
```

For the explorer:
```bash
cd aetherium-nova-explorer
npm install
echo "VITE_API_URL=http://localhost:3001\nVITE_API_KEY=dev-key" > .env.local
npx vite
```

---

## Pull Request Guidelines

1. **Branch naming**: `feat/short-description`, `fix/short-description`, `docs/short-description`
2. **Commit messages**: Use [Conventional Commits](https://www.conventionalcommits.org/) — `feat:`, `fix:`, `docs:`, `refactor:`, `test:`
3. **One concern per PR** — keep PRs focused; large PRs are hard to review
4. **Tests**: Add or update tests for any logic changes in `src/`
5. **Build must pass**: `npm run build` must succeed with zero errors before opening a PR

---

## Code Style

- TypeScript strict mode (`"strict": true` in `tsconfig.json`)
- No `any` types without justification in a comment
- All public functions must have a JSDoc comment explaining parameters and return values
- Use `const` by default; avoid `let` where immutability is possible

---

## Reporting Security Vulnerabilities

**Do not open a public issue for security bugs.** See [SECURITY.md](.github/SECURITY.md).

---

## Code of Conduct

By participating, you agree to our [Code of Conduct](CODE_OF_CONDUCT.md). We are committed to a welcoming and harassment-free environment for everyone.
