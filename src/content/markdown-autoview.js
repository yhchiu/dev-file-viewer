import { runAutoView } from './autoView.js';

runAutoView().catch(error => {
  console.warn('Dev File Viewer could not preview this document:', error);
});
