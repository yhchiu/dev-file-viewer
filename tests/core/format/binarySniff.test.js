import { describe, it, expect } from 'vitest';
// jsdom's Blob lacks arrayBuffer(); use Node's spec-complete Blob (real
// browsers implement arrayBuffer(), so production code is unaffected).
import { Blob } from 'node:buffer';
import { isLikelyBinaryFile } from '../../../src/core/format/binarySniff.js';

function blobFromBytes(bytes) {
  return new Blob([new Uint8Array(bytes)]);
}

describe('isLikelyBinaryFile', () => {
  it('flags content containing a NUL byte', async () => {
    expect(await isLikelyBinaryFile(blobFromBytes([104, 105, 0, 104]))).toBe(true);
  });

  it('treats normal UTF-8 text as non-binary', async () => {
    expect(await isLikelyBinaryFile(new Blob(['hello world\n\ttabbed line\r\n']))).toBe(false);
  });

  it('flags a high ratio of control characters', async () => {
    expect(await isLikelyBinaryFile(blobFromBytes(new Array(100).fill(1)))).toBe(true);
  });

  it('returns false for empty input and falsy file', async () => {
    expect(await isLikelyBinaryFile(new Blob([]))).toBe(false);
    expect(await isLikelyBinaryFile(null)).toBe(false);
  });
});
