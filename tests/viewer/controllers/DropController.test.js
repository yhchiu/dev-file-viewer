import { describe, it, expect } from 'vitest';
import {
  DropController,
  dragEventHasFiles
} from '../../../src/viewer/controllers/DropController.js';

describe('dragEventHasFiles', () => {
  it('is true only when the drag carries files', () => {
    expect(dragEventHasFiles({ dataTransfer: { types: ['Files'] } })).toBe(true);
    expect(dragEventHasFiles({ dataTransfer: { types: ['text/plain'] } })).toBe(false);
    expect(dragEventHasFiles({})).toBe(false);
  });
});

describe('DropController.resolveDroppedItem (files fallback)', () => {
  const controller = new DropController({ elements: {} });

  it('marks a supported file as rich (not plain text)', async () => {
    const item = await controller.resolveDroppedItem({ items: [], files: [{ name: 'a.md' }] });
    expect(item).toEqual({ kind: 'file', file: { name: 'a.md' }, forcePlainText: false });
  });

  it('forces plain text for an unsupported file', async () => {
    const item = await controller.resolveDroppedItem({ items: [], files: [{ name: 'a.png' }] });
    expect(item).toEqual({ kind: 'file', file: { name: 'a.png' }, forcePlainText: true });
  });

  it('returns null when nothing droppable is present', async () => {
    expect(await controller.resolveDroppedItem({ items: [], files: [] })).toBeNull();
  });
});
