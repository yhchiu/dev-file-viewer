export const features = Object.freeze({
  formats: {
    markdown: true,
    diff: false,
    sourceCode: true
  },
  markdown: {
    gfm: true,
    breaks: false,
    headerIds: false
  },
  syntaxHighlighting: {
    markdownCodeBlocks: true
  },
  plugins: {
    mermaid: true,
    emoji: false,
    math: false,
    toc: false,
    alerts: false,
    checkboxes: false, // Reserved for V2 UI polish; tables are enabled through GFM parsing in V1.1.
    abbreviations: false,
    annotations: false
  },
  themes: {
    light: true,
    dark: false
  },
  shortcuts: false
});
