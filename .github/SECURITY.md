# Security Policy

## Supported Versions

| Version | Supported |
|---|---|
| 2.x (current) | ✅ Yes |
| 1.x | ❌ No longer supported |

---

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

If you discover a security vulnerability in Aetherium Nova, please report it responsibly:

1. **Email**: security@aetherium-nova.io *(or open a [GitHub Security Advisory](https://github.com/ashrafmusa/Aetherium_Nova_v2/security/advisories/new))*
2. **Include**:
   - A description of the vulnerability and its potential impact
   - Steps to reproduce or a proof-of-concept (if safe to share)
   - Affected component(s) — e.g., `src/wallet.ts`, `src/chain.ts`, P2P layer
   - Your GitHub handle (optional, for credit)

---

## What to Expect

- **Acknowledgement**: Within 48 hours of your report
- **Assessment**: Within 7 days — we will evaluate severity and scope
- **Patch timeline**: Critical issues patched within 14 days; moderate within 30 days
- **Disclosure**: Coordinated public disclosure after the patch is released

---

## Scope

The following are **in scope** for security reports:

- Cryptographic flaws in `src/wallet.ts` (key generation, signing, address derivation)
- Consensus manipulation in `src/chain.ts` or `src/staking.ts` (double spend, long-range attacks)
- Authentication bypass in `src/auth.ts`
- P2P network attacks in `src/services/p2p.ts` (eclipse attacks, poisoning)
- Smart contract VM sandbox escapes in `src/vm.ts`
- API injection or privilege escalation in `src/node.ts`

The following are **out of scope**:

- Denial of service against a single node (expected in public networks)
- Issues requiring physical access to the host machine
- Bugs in third-party dependencies (report those upstream)

---

## Recognition

Security researchers who responsibly disclose valid vulnerabilities will be credited in release notes and our security hall of fame (with permission).
