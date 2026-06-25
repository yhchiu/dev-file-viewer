export const features = Object.freeze({
  formats: {
    markdown: true,
    diff: true,
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
    diagramZoom: true,
    emoji: false,
    math: false,
    toc: false,
    alerts: false,
    checkboxes: false, // Reserved for V2 UI polish; tables are enabled through GFM parsing in V1.1.
    abbreviations: false,
    annotations: false
  },
  themes: {
    bloom: true,
    forge: true,
    folio: true,
    system: true
  },
  shortcuts: false
});
