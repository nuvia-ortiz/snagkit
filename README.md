# Snagkit

**A QA toolkit that lives in your browser.** Catch a bug, click once, and get a complete report: annotated screenshot, steps to reproduce, console errors, failed requests and environment details — ready to paste into GitHub, Jira, Linear or Slack.

Everything runs locally. Snagkit has no server, no account and makes no network requests of its own.

<p align="center">
  <img src="docs/popup.png" alt="Snagkit popup showing console errors, failed requests and recorded steps" width="300">
</p>

![Bug report editor with annotated screenshot, steps, console errors and failed requests](docs/report.png)

## Why

Writing a good bug report takes time: reproduce it, take a screenshot, open DevTools, copy the errors, note the browser and screen size, and write down every step you took. Snagkit records all of that in the background while you test, so the report is ready the moment you find the bug.

## Features

### 🐞 Bug reports (available)

- **Steps to reproduce, written for you.** Clicks, typing, dropdowns, checkboxes, form submissions and page changes become readable steps like `Click button "Pay now"` — including in single-page apps.
- **Console errors and failed requests** (HTTP 4xx/5xx and network errors) from the current tab.
- **Annotated screenshot**: boxes, arrows, freehand pen and a *Hide* tool that pixelates sensitive areas permanently.
- **Environment**: browser, OS, viewport, screen, pixel ratio, language and time.
- **Export** as Markdown, Jira markup, PNG or `.md`, or open a pre-filled GitHub issue.
- **English and Spanish** interface and reports.

### 📝 Form tester (coming soon)

Finds every form on the page and tries empty, invalid and extreme values, then lists the fields that accept bad data, show no error message or have no accessible label.

### 💥 UI stress test (coming soon)

Breaks the page on purpose — longer text, emojis, missing images, larger fonts — and highlights the elements that overflow or get cut off.

## Privacy by design

- **Typed text is never recorded.** Steps say *"Type in field Email"*, never what was typed. Passwords included.
- **Secrets in URLs are redacted** automatically (`token`, `apiKey`, `session`, `code`… → `[redacted]`), as are credentials embedded in URLs.
- **Nothing leaves your computer.** Data is kept per tab in the browser's session storage and deleted when the tab closes. Only the 20 most recent report drafts are kept.

## Install

Snagkit is not on the Chrome Web Store yet. To try it:

```bash
git clone https://github.com/nuvia-ortiz/snagkit.git
cd snagkit
npm install
npm run build
```

Then open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked** and select the `dist` folder. Works in Chrome, Edge, Brave and other Chromium browsers.

Reload any page that was already open so Snagkit can start recording it.

## How it works

```
 page (MAIN world)          content script            service worker              extension pages
┌──────────────────┐  post  ┌──────────────┐  send   ┌───────────────────┐  open   ┌─────────────┐
│ page-hooks.ts    │──────▶│ recorder.ts  │───────▶│ background.ts     │───────▶│ report page │
│ console, errors, │ message│ clicks, input│ message │ per-tab sessions  │         │ annotate &  │
│ SPA navigation   │        │ change, keys │         │ + webRequest (4xx,│         │ export      │
└──────────────────┘        └──────────────┘         │   5xx, failures)  │         └─────────────┘
                                                      └───────────────────┘
```

- **`src/content/page-hooks.ts`** runs inside the page to see its console errors, uncaught exceptions and `history.pushState` navigation.
- **`src/content/recorder.ts`** listens for user actions and describes each element the way a person would read it (`src/shared/describe.ts`).
- **`src/background.ts`** stores a capped session per tab, watches failed requests with `chrome.webRequest`, and captures the screenshot.
- **`src/report/`** is a React app with a canvas annotator and the exporters (`src/shared/report.ts`).

## Tech stack

TypeScript · React 19 · Tailwind CSS 4 · Vite · esbuild · Chrome Extensions Manifest V3 · Vitest · Playwright

## Development

```bash
npm run build      # build the extension into dist/
npm run typecheck  # TypeScript checks
npm test           # unit tests (Vitest + jsdom)
npm run test:e2e   # end-to-end test: loads the extension in Chromium and files a real report
```

The end-to-end test opens a sample checkout page, fills in the form, triggers a console error and a failing request, creates a report through the popup and checks that the steps, errors and redactions are correct.

## Roadmap

- [x] Bug reports with steps, console, network, environment and annotated screenshot
- [ ] Form tester
- [ ] UI stress test
- [ ] Short screen recording of the last seconds before the bug
- [ ] Chrome Web Store release

## License

[MIT](LICENSE) © Nuvia Ortiz Basulto
