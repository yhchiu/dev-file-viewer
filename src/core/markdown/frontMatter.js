const KEY_LIKE =
  /^(?:[A-Za-z_][\w.-]*|\d+|"[^"\\]*(?:\\.[^"\\]*)*"|'[^']*(?:''[^']*)*')\s*:(?:\s|$)/;
const BLOCK_SCALAR_INDICATOR = /^([>|])([+-])?(\d+)?[ \t]*(#.*)?$/;

/**
 * Split a Markdown document into YAML front matter (if present) and the body.
 * Conservative: optional BOM, then `---` must be the first non-BOM bytes.
 * A closing `---` and at least one `key:`-like line are required; otherwise
 * the original text is returned unchanged so a leading thematic break is kept.
 *
 * @param {string} text
 * @returns {{
 *   body: string,
 *   matter: null | { raw: string, entries: Array<{ key: string, display: string }> | null }
 * }}
 */
export function extractFrontMatter(text) {
  const source = text == null ? '' : String(text);
  if (!source) return { body: '', matter: null };

  const hasBom = source.charCodeAt(0) === 0xfeff;
  const rest = hasBom ? source.slice(1) : source;

  const opening = matchFenceLine(rest, 0);
  if (!opening || opening.start !== 0 || !opening.hadNewline) {
    return { body: source, matter: null };
  }

  const closing = findClosingFence(rest, opening.end);
  if (!closing) return { body: source, matter: null };

  const inner = rest.slice(opening.end, closing.start);
  if (!hasKeyLikeLine(inner)) return { body: source, matter: null };

  let entries = null;
  try {
    entries = parseYamlSubset(inner);
  } catch {
    // Invalid subset YAML still strips; the inner text is shown as a code fence.
  }

  return {
    body: rest.slice(closing.end),
    matter: { raw: inner, entries }
  };
}

/**
 * Turn extracted front matter into Markdown that the existing GFM table / code
 * renderers already know how to display. Cell text is HTML-escaped so values
 * stay literal (no emphasis, autolinks, or raw HTML).
 *
 * @param {{ raw: string, entries: Array<{ key: string, display: string }> | null }} matter
 * @returns {string}
 */
export function frontMatterToMarkdown(matter) {
  if (!matter) return '';
  if (matter.entries) {
    if (matter.entries.length === 0) return '';
    const rows = matter.entries.map(
      ({ key, display }) => `| ${escapeTableCell(key)} | ${escapeTableCell(display)} |`
    );
    // GFM requires a header row. An empty one keeps every real field in
    // `<tbody>` so CSS can hide `<thead>` without dropping a data row.
    return ['| | |', '| --- | --- |', ...rows].join('\n');
  }
  return fenceCode(matter.raw || '');
}

/**
 * @param {string} body
 * @param {{ raw: string, entries: Array<{ key: string, display: string }> | null }} matter
 * @returns {string}
 */
export function mergeFrontMatterMarkdown(body, matter) {
  const block = frontMatterToMarkdown(matter);
  if (!block) return body;
  const rest = String(body || '').replace(/^\n+/, '');
  return rest ? `${block}\n\n${rest}` : `${block}\n`;
}

/**
 * Tag the table or code block that mergeFrontMatterMarkdown prepended.
 *
 * @param {ParentNode} root
 * @param {{ entries: Array<{ key: string, display: string }> | null }} matter
 */
export function markFrontMatterOutput(root, matter) {
  if (matter.entries) {
    const table = root.querySelector(':scope > table');
    if (table) {
      table.setAttribute('data-front-matter', '');
      table.querySelector('thead')?.setAttribute('aria-hidden', 'true');
    }
    return;
  }
  const pre = root.querySelector(':scope > pre');
  if (pre) pre.setAttribute('data-front-matter-raw', '');
}

const TABLE_CELL_ESCAPES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '|': '&#124;',
  '*': '&#42;',
  _: '&#95;',
  '`': '&#96;',
  '[': '&#91;',
  ']': '&#93;',
  '!': '&#33;',
  '~': '&#126;',
  '\\': '&#92;'
};

function escapeTableCell(value) {
  return String(value)
    .replace(/[&<>|*_`[\]!~\\]/g, char => TABLE_CELL_ESCAPES[char])
    .replace(/:\/\//g, '&#58;//')
    .replace(/\r\n|\r|\n/g, '<br>');
}

function fenceCode(raw) {
  const text = String(raw);
  const runs = text.match(/`+/g);
  const ticks = Math.max(3, ...(runs ? runs.map(run => run.length + 1) : [3]));
  const fence = '`'.repeat(ticks);
  const body = text.endsWith('\n') ? text : `${text}\n`;
  return `${fence}\n${body}${fence}`;
}

function matchFenceLine(text, start) {
  if (text.slice(start, start + 3) !== '---') return null;

  let index = start + 3;
  while (index < text.length && (text[index] === ' ' || text[index] === '\t')) index += 1;
  if (text[index] === '-') return null;

  if (index >= text.length) return { start, end: index, hadNewline: false };
  if (text[index] === '\r') {
    index += 1;
    if (text[index] === '\n') index += 1;
    return { start, end: index, hadNewline: true };
  }
  if (text[index] === '\n') return { start, end: index + 1, hadNewline: true };
  return null;
}

function findClosingFence(text, from) {
  let lineStart = from;
  while (lineStart <= text.length) {
    const fence = matchFenceLine(text, lineStart);
    if (fence && fence.start === lineStart) return fence;
    const newline = text.indexOf('\n', lineStart);
    if (newline === -1) return null;
    lineStart = newline + 1;
  }
  return null;
}

function hasKeyLikeLine(inner) {
  for (const rawLine of inner.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    if (KEY_LIKE.test(line) || isQuotedKeyLike(line)) return true;
  }
  return false;
}

function isQuotedKeyLike(line) {
  if (line[0] !== '"' && line[0] !== "'") return false;
  try {
    const quoted = parseQuoted(line, 0);
    const after = line.slice(quoted.end).replace(/^[ \t]+/, '');
    if (after[0] !== ':') return false;
    return after.length === 1 || /[\s#]/.test(after[1]);
  } catch {
    return false;
  }
}

function parseYamlSubset(raw) {
  const lines = splitLines(raw);
  const parser = new LineParser(lines);
  parser.skipEmptyAndComments();
  if (parser.done()) throw new Error('empty');
  if (parser.peek().content.startsWith('%')) throw new Error('directive');
  if (parser.peek().content.startsWith('-')) throw new Error('root-sequence');

  const mapping = parser.parseMapping(parser.peek().indent);
  parser.skipEmptyAndComments();
  if (!parser.done()) throw new Error('trailing');

  return mapping.entries.map(entry => ({
    key: entry.key,
    display: formatValue(entry.value)
  }));
}

function splitLines(raw) {
  const lines = [];
  let start = 0;
  for (let index = 0; index < raw.length; index += 1) {
    if (raw[index] !== '\n') continue;
    const end = index > 0 && raw[index - 1] === '\r' ? index - 1 : index;
    lines.push(makeLine(raw.slice(start, end)));
    start = index + 1;
  }
  if (start < raw.length) {
    const last = raw.endsWith('\r') ? raw.slice(start, -1) : raw.slice(start);
    lines.push(makeLine(last));
  }
  return lines;
}

function makeLine(raw) {
  let indent = 0;
  while (indent < raw.length) {
    if (raw[indent] === ' ') {
      indent += 1;
      continue;
    }
    if (raw[indent] === '\t') throw new Error('tab-indent');
    break;
  }
  const content = raw.slice(indent);
  const trimmed = content.trim();
  return {
    raw,
    indent,
    content,
    blank: trimmed === '',
    commentOnly: trimmed.startsWith('#')
  };
}

class LineParser {
  constructor(lines) {
    this.lines = lines;
    this.index = 0;
  }

  done() {
    return this.index >= this.lines.length;
  }

  peek() {
    return this.lines[this.index];
  }

  skipEmptyAndComments() {
    while (!this.done()) {
      const line = this.peek();
      if (line.blank || line.commentOnly) this.index += 1;
      else break;
    }
  }

  parseMapping(expectedIndent) {
    const entries = [];
    const keys = new Set();

    while (!this.done()) {
      this.skipEmptyAndComments();
      if (this.done()) break;

      const line = this.peek();
      if (line.indent < expectedIndent) break;
      if (line.indent > expectedIndent) throw new Error('indent');
      if (line.content === '-' || line.content.startsWith('- ')) {
        throw new Error('sequence-in-mapping');
      }

      const { key, rest } = parseKeyValueHead(line.content);
      if (key === '<<') throw new Error('merge');
      if (keys.has(key)) throw new Error('duplicate');
      keys.add(key);

      this.index += 1;
      const value = this.parseValue(rest, line.indent);
      entries.push({ key, value });
    }

    if (entries.length === 0) throw new Error('empty-mapping');
    return { type: 'map', entries };
  }

  parseValue(rest, keyIndent) {
    const trimmed = rest.replace(/^[ \t]+/, '');
    if (trimmed === '' || trimmed.startsWith('#')) {
      return this.parseIndentedValue(keyIndent);
    }

    const indicator = BLOCK_SCALAR_INDICATOR.exec(trimmed);
    if (indicator) return this.parseBlockScalar(indicator, keyIndent);

    return parseInlineValue(trimmed);
  }

  parseIndentedValue(keyIndent) {
    this.skipEmptyAndComments();
    if (this.done()) return { type: 'scalar', text: '' };

    const next = this.peek();
    if (next.indent <= keyIndent) return { type: 'scalar', text: '' };
    if (next.content === '-' || next.content.startsWith('- ')) {
      return this.parseBlockSequence(next.indent);
    }
    return this.parseMapping(next.indent);
  }

  parseBlockSequence(seqIndent) {
    const items = [];

    while (!this.done()) {
      this.skipEmptyAndComments();
      if (this.done()) break;

      const line = this.peek();
      if (line.indent < seqIndent) break;
      if (line.indent > seqIndent) throw new Error('indent');
      if (line.content !== '-' && !line.content.startsWith('- ')) break;

      const after = line.content === '-' ? '' : line.content.slice(2);
      this.index += 1;
      items.push(this.parseSequenceItem(after, line.indent));
    }

    if (items.length === 0) throw new Error('empty-sequence');
    return { type: 'list', items };
  }

  parseSequenceItem(after, dashIndent) {
    const trimmed = after.replace(/^[ \t]+/, '');
    const childIndent = dashIndent + 2;

    if (trimmed === '' || trimmed.startsWith('#')) {
      this.skipEmptyAndComments();
      if (this.done() || this.peek().indent <= dashIndent) {
        return { type: 'scalar', text: '' };
      }
      const next = this.peek();
      if (next.content === '-' || next.content.startsWith('- ')) {
        return this.parseBlockSequence(next.indent);
      }
      return this.parseMapping(next.indent);
    }

    const indicator = BLOCK_SCALAR_INDICATOR.exec(trimmed);
    if (indicator) return this.parseBlockScalar(indicator, dashIndent);

    if (looksLikeInlineMapping(trimmed)) {
      const head = parseKeyValueHead(trimmed);
      const firstValue = this.parseValue(head.rest, dashIndent);
      const extra = this.collectMappingEntries(childIndent, head.key);
      return {
        type: 'map',
        entries: [{ key: head.key, value: firstValue }, ...extra]
      };
    }

    return parseInlineValue(trimmed);
  }

  collectMappingEntries(expectedIndent, firstKey) {
    const entries = [];
    const keys = new Set([firstKey]);

    while (!this.done()) {
      this.skipEmptyAndComments();
      if (this.done()) break;

      const line = this.peek();
      if (line.indent < expectedIndent) break;
      if (line.indent > expectedIndent) throw new Error('indent');
      if (line.content === '-' || line.content.startsWith('- ')) break;

      const { key, rest } = parseKeyValueHead(line.content);
      if (key === '<<') throw new Error('merge');
      if (keys.has(key)) throw new Error('duplicate');
      keys.add(key);

      this.index += 1;
      entries.push({ key, value: this.parseValue(rest, line.indent) });
    }

    return entries;
  }

  parseBlockScalar(indicator, keyIndent) {
    const folded = indicator[1] === '>';
    const chomp = indicator[2] || '';
    const explicitIndent = indicator[3] ? Number(indicator[3]) : null;
    const collected = [];

    while (!this.done()) {
      const line = this.peek();
      if (!line.blank && line.indent <= keyIndent) break;
      collected.push(line);
      this.index += 1;
    }

    const contentLines = collected.filter(line => !line.blank);
    if (contentLines.length === 0) return { type: 'scalar', text: '' };

    const contentIndent =
      explicitIndent == null
        ? Math.min(...contentLines.map(line => line.indent))
        : keyIndent + explicitIndent;

    const pieces = collected.map(line => {
      if (line.blank) return '';
      if (line.indent < contentIndent) throw new Error('block-indent');
      return `${' '.repeat(line.indent - contentIndent)}${line.content}`;
    });

    const joined = folded ? foldBlockScalar(pieces) : pieces.join('\n');
    return { type: 'scalar', text: chompBlockScalar(joined, chomp) };
  }
}

function parseKeyValueHead(content) {
  let index = 0;
  while (content[index] === ' ' || content[index] === '\t') index += 1;
  if (content[index] === '!' || content[index] === '&' || content[index] === '*') {
    throw new Error('tag');
  }

  let key;
  if (content[index] === '"' || content[index] === "'") {
    const quoted = parseQuoted(content, index);
    key = quoted.value;
    index = quoted.end;
  } else {
    const match = /^(?:[A-Za-z_][\w.-]*|\d+)/.exec(content.slice(index));
    if (!match) throw new Error('key');
    key = match[0];
    index += match[0].length;
  }

  while (content[index] === ' ' || content[index] === '\t') index += 1;
  if (content[index] !== ':') throw new Error('colon');
  return { key, rest: content.slice(index + 1) };
}

function looksLikeInlineMapping(text) {
  try {
    parseKeyValueHead(text);
    return true;
  } catch {
    return false;
  }
}

function parseInlineValue(text) {
  if (text[0] === '"' || text[0] === "'") {
    const quoted = parseQuoted(text, 0);
    const after = text.slice(quoted.end).trim();
    if (after && !after.startsWith('#')) throw new Error('trailing');
    return { type: 'scalar', text: quoted.value };
  }

  if (/^[&*!]/.test(text) || text.startsWith('%')) throw new Error('tag');
  if (text[0] === '[' || text[0] === '{') return parseFlow(text);
  if (text[0] === '|' || text[0] === '>') throw new Error('block-indicator');

  return { type: 'scalar', text: splitPlainAndComment(text) };
}

function splitPlainAndComment(text) {
  for (let index = 0; index < text.length; index += 1) {
    if (
      text[index] === '#' &&
      (index === 0 || text[index - 1] === ' ' || text[index - 1] === '\t')
    ) {
      return text.slice(0, index).trimEnd();
    }
  }
  return text.trimEnd();
}

function parseFlow(text) {
  let index = 0;

  function skipSpace() {
    while (index < text.length && (text[index] === ' ' || text[index] === '\t')) index += 1;
    if (text[index] === '#') index = text.length;
  }

  function parseValue() {
    skipSpace();
    if (text[index] === '[') return parseSequence();
    if (text[index] === '{') return parseMapping();
    if (text[index] === '"' || text[index] === "'") {
      const quoted = parseQuoted(text, index);
      index = quoted.end;
      return { type: 'scalar', text: quoted.value };
    }
    if (text[index] === '&' || text[index] === '*' || text[index] === '!') throw new Error('tag');

    const start = index;
    while (index < text.length && !/[,\]}#]/.test(text[index])) index += 1;
    return { type: 'scalar', text: text.slice(start, index).trim() };
  }

  function parseSequence() {
    if (text[index] !== '[') throw new Error('flow-seq');
    index += 1;
    const items = [];
    skipSpace();
    if (text[index] === ']') {
      index += 1;
      return { type: 'list', items };
    }
    while (index < text.length) {
      items.push(parseValue());
      skipSpace();
      if (text[index] === ',') {
        index += 1;
        skipSpace();
        if (text[index] === ']') {
          index += 1;
          break;
        }
        continue;
      }
      if (text[index] === ']') {
        index += 1;
        break;
      }
      throw new Error('flow-seq');
    }
    return { type: 'list', items };
  }

  function parseMapping() {
    if (text[index] !== '{') throw new Error('flow-map');
    index += 1;
    const entries = [];
    const keys = new Set();
    skipSpace();
    if (text[index] === '}') {
      index += 1;
      return { type: 'map', entries };
    }
    while (index < text.length) {
      skipSpace();
      const remaining = text.slice(index);
      const colon = findFlowKeyColon(remaining);
      const { key } = parseKeyValueHead(`${remaining.slice(0, colon)}:`);
      if (key === '<<') throw new Error('merge');
      if (keys.has(key)) throw new Error('duplicate');
      keys.add(key);
      index += colon + 1;
      const value = parseValue();
      entries.push({ key, value });
      skipSpace();
      if (text[index] === ',') {
        index += 1;
        skipSpace();
        if (text[index] === '}') {
          index += 1;
          break;
        }
        continue;
      }
      if (text[index] === '}') {
        index += 1;
        break;
      }
      throw new Error('flow-map');
    }
    return { type: 'map', entries };
  }

  const value = parseValue();
  skipSpace();
  if (index < text.length && text[index] !== '#') throw new Error('flow-trailing');
  return value;
}

function findFlowKeyColon(text) {
  if (text[0] === '"' || text[0] === "'") {
    const quoted = parseQuoted(text, 0);
    const after = text.slice(quoted.end);
    const match = /^[ \t]*:/.exec(after);
    if (!match) throw new Error('flow-colon');
    return quoted.end + match[0].length - 1;
  }
  const match = /^(?:[A-Za-z_][\w.-]*|\d+)[ \t]*:/.exec(text);
  if (!match) throw new Error('flow-key');
  return match[0].length - 1;
}

function parseQuoted(text, start) {
  const quote = text[start];
  let index = start + 1;
  let value = '';

  if (quote === "'") {
    while (index < text.length) {
      const char = text[index];
      if (char === "'") {
        if (text[index + 1] === "'") {
          value += "'";
          index += 2;
          continue;
        }
        return { value, end: index + 1 };
      }
      if (char === '\n' || char === '\r') throw new Error('quoted-newline');
      value += char;
      index += 1;
    }
    throw new Error('unclosed');
  }

  if (quote !== '"') throw new Error('quote');

  while (index < text.length) {
    const char = text[index];
    if (char === '"') return { value, end: index + 1 };
    if (char === '\n' || char === '\r') throw new Error('quoted-newline');
    if (char === '\\') {
      index += 1;
      if (index >= text.length) throw new Error('escape');
      const escaped = text[index];
      const simple = { n: '\n', t: '\t', r: '\r', '"': '"', '\\': '\\', '/': '/', 0: '\0' };
      if (escaped in simple) {
        value += simple[escaped];
        index += 1;
        continue;
      }
      if (escaped === 'x' && /^[0-9a-fA-F]{2}/.test(text.slice(index + 1, index + 3))) {
        value += String.fromCharCode(parseInt(text.slice(index + 1, index + 3), 16));
        index += 3;
        continue;
      }
      if (escaped === 'u' && /^[0-9a-fA-F]{4}/.test(text.slice(index + 1, index + 5))) {
        value += String.fromCharCode(parseInt(text.slice(index + 1, index + 5), 16));
        index += 5;
        continue;
      }
      throw new Error('escape');
    }
    value += char;
    index += 1;
  }
  throw new Error('unclosed');
}

function foldBlockScalar(pieces) {
  let result = '';
  for (let index = 0; index < pieces.length; index += 1) {
    const line = pieces[index];
    const next = pieces[index + 1];
    if (line === '') {
      result += '\n';
      continue;
    }
    result += line;
    if (next === undefined) break;
    if (next === '' || /^[ \t]/.test(next)) result += '\n';
    else result += ' ';
  }
  return result;
}

function chompBlockScalar(value, chomp) {
  if (chomp === '+') return value;
  return value.replace(/\n+$/, '');
}

function formatValue(value) {
  if (value.type === 'scalar') return value.text;
  if (value.type === 'list' && value.items.every(item => item.type === 'scalar')) {
    return value.items.map(item => item.text).join(', ');
  }
  return formatIndented(value, 0).replace(/\n+$/, '');
}

function formatIndented(value, indent) {
  const pad = '  '.repeat(indent);
  if (value.type === 'scalar') return `${pad}${value.text}`;
  if (value.type === 'list') {
    return value.items
      .map(item => {
        if (item.type === 'scalar') return `${pad}- ${item.text}`;
        if (item.type === 'map' && item.entries.length > 0) {
          const [first, ...rest] = item.entries;
          return [
            formatMapEntry(first, `${pad}- `, indent + 1),
            ...rest.map(entry => formatMapEntry(entry, `${pad}  `, indent + 1))
          ].join('\n');
        }
        return `${pad}-\n${formatIndented(item, indent + 1)}`;
      })
      .join('\n');
  }
  return value.entries.map(entry => formatMapEntry(entry, pad, indent)).join('\n');
}

function formatMapEntry(entry, prefix, indent) {
  if (entry.value.type === 'scalar') {
    return entry.value.text === ''
      ? `${prefix}${entry.key}:`
      : `${prefix}${entry.key}: ${entry.value.text}`;
  }
  if (entry.value.type === 'list' && entry.value.items.every(item => item.type === 'scalar')) {
    return `${prefix}${entry.key}: ${entry.value.items.map(item => item.text).join(', ')}`;
  }
  return `${prefix}${entry.key}:\n${formatIndented(entry.value, indent + 1)}`;
}
