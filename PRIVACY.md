# Privacy Policy

Dev File Viewer runs locally in the browser.

- No analytics
- No telemetry
- No tracking pixels
- No cookies created by the extension
- No remote code execution
- No uploaded documents
- No server-side processing

When the user opens a remote `http://` or `https://` Markdown URL, Chrome fetches that URL in the browser so the extension can render it locally.

For local files, the recommended workflow is **Open File** or **Open Folder**. The extension reads only the user-selected file or folder. If the user enables Chrome's optional **Allow access to file URLs** setting, Dev File Viewer can automatically preview supported `file://` Markdown URLs. Local files and selected folders stay on the user's machine and are processed client-side only.
