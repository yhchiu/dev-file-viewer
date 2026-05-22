const SAMPLE_SIZE = 8192;

export async function isLikelyBinaryFile(file) {
  if (!file) return false;

  const blob = file.slice(0, SAMPLE_SIZE);
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  if (!bytes.length) return false;

  let suspicious = 0;
  let checked = 0;

  for (const byte of bytes) {
    checked += 1;

    if (byte === 0) return true;
    if (byte === 9 || byte === 10 || byte === 12 || byte === 13) continue;
    if (byte < 32) suspicious += 1;
  }

  return checked > 0 && suspicious / checked > 0.08;
}
