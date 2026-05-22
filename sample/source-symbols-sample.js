export class DevFileViewerApp {
  constructor() {
    this.ready = false;
  }

  async start() {
    await this.bindEvents();
  }

  bindEvents() {
    console.log('bind');
  }

  renderDocument(doc) {
    return doc;
  }
}

export function normalizeLinkData(link) {
  return String(link || '').trim();
}

const openViewer = async (url) => {
  return url;
};

interface ViewerOptions {
  theme: string;
}

type ViewerMode = 'markdown' | 'source' | 'diff';
