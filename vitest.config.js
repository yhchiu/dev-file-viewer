import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // jsdom is the DOMPurify-compatible environment; required by the security,
    // rendering and DOM-helper tests. Pure-logic tests run fine under it too.
    environment: 'jsdom',
    globals: true,
    setupFiles: ['tests/setup.js'],
    include: ['tests/**/*.test.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**'],
      // Import-time side-effectful entry/wiring files (instantiate the app,
      // call chrome.*, or auto-run on load). Verified manually / via the build,
      // not by unit tests. app.js's pure logic lives in viewerHelpers.js.
      exclude: [
        'src/viewer/app.js',
        'src/popup/popup.js',
        'src/settings/settings.js',
        'src/content/markdown-autoview.js',
        'src/content/inline-mermaid.js',
        'src/content/autoView.js',
        'src/content/inlinePreview.js',
        'src/background/service-worker.js',
        'src/core/browser/fileUrlAccess.js',
        'src/core/ui/chromeTheme.js'
      ],
      thresholds: {
        statements: 80,
        lines: 80,
        functions: 80,
        branches: 70
      }
    }
  }
});
