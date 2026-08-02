# Security Policy

SpeechImprover is a **client-side-only** web app: it has no backend, no accounts, and no servers
operated by the project. Your data stays in your browser (see [PRIVACY.md](PRIVACY.md)). As such,
the most relevant security concerns are things like cross-site scripting (XSS), unsafe handling of
imported data, and vulnerabilities in third-party dependencies.

## Reporting a vulnerability

Please report security issues **privately** — do not open a public issue for them.

- **Preferred:** open a private report via GitHub Security Advisories →
  [Report a vulnerability](https://github.com/adervec/SpeechImprover/security/advisories/new)
- **Alternatively:** email **adervec@gmail.com** with details.

Please include:

- a description of the issue and its potential impact,
- steps to reproduce (a proof of concept if possible),
- the browser/OS and app version/commit.

## What to expect

This is a volunteer, non-commercial project, so responses are best-effort. I'll aim to acknowledge
a report within about a week and to address confirmed, in-scope issues as soon as I reasonably can.
There is **no bug-bounty or paid reward** program.

## Scope

- **In scope:** the app source in this repository and its build/deploy configuration.
- **Out of scope:** vulnerabilities in your browser's own APIs (e.g. the Web Speech API),
  GitHub Pages infrastructure, or third-party services — please report those to the relevant vendor.

Thank you for helping keep users safe.
