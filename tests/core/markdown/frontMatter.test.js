import { describe, expect, it } from 'vitest';
import {
  extractFrontMatter,
  frontMatterToMarkdown,
  mergeFrontMatterMarkdown
} from '../../../src/core/markdown/frontMatter.js';

function wrap(inner, body = '# Body') {
  return `---\n${inner}\n---\n\n${body}`;
}

describe('extractFrontMatter — recognition', () => {
  it('leaves ordinary Markdown unchanged', () => {
    const source = '# Title\n\nHello';
    expect(extractFrontMatter(source)).toEqual({ body: source, matter: null });
  });

  it('strips a leading YAML block and keeps the body', () => {
    const result = extractFrontMatter(wrap('title: Hello\ntags: [a, b]'));
    expect(result.body).toBe('\n# Body');
    expect(result.matter.entries).toEqual([
      { key: 'title', display: 'Hello' },
      { key: 'tags', display: 'a, b' }
    ]);
  });

  it('allows a leading UTF-8 BOM before the opening fence', () => {
    const result = extractFrontMatter(`\uFEFF${wrap('title: Hello')}`);
    expect(result.matter.entries).toEqual([{ key: 'title', display: 'Hello' }]);
    expect(result.body).toBe('\n# Body');
  });

  it('does not treat a leading blank line as front matter', () => {
    const source = `\n---\ntitle: Hello\n---\n\n# Body`;
    expect(extractFrontMatter(source).matter).toBeNull();
  });

  it('does not treat leading whitespace as front matter', () => {
    const source = ` ---\ntitle: Hello\n---\n`;
    expect(extractFrontMatter(source).matter).toBeNull();
  });

  it('does not treat four dashes as a fence', () => {
    const source = `----\ntitle: Hello\n----\n\n# Body`;
    expect(extractFrontMatter(source).matter).toBeNull();
  });

  it('requires a closing fence', () => {
    const source = '---\ntitle: Hello\n\n# Body';
    expect(extractFrontMatter(source).matter).toBeNull();
  });

  it('requires at least one key-like line', () => {
    expect(extractFrontMatter('---\n\n---\n\n# Body').matter).toBeNull();
    expect(extractFrontMatter('---\n# only a comment\n---\n\n# Body').matter).toBeNull();
    expect(extractFrontMatter('---\nsee http://example.com\n---\n\n# Body').matter).toBeNull();
  });

  it('does not treat a mid-document thematic break as front matter', () => {
    const source = '# Title\n\n---\n\nNext';
    expect(extractFrontMatter(source).matter).toBeNull();
  });

  it('accepts CRLF fences', () => {
    const result = extractFrontMatter('---\r\ntitle: Hello\r\n---\r\n\r\n# Body');
    expect(result.matter.entries).toEqual([{ key: 'title', display: 'Hello' }]);
    expect(result.body).toBe('\r\n# Body');
  });
});

describe('extractFrontMatter — subset parse', () => {
  it('keeps scalars as written without YAML 1.1 coercion', () => {
    const result = extractFrontMatter(
      wrap(['country: no', 'published: true', 'count: 01', 'date: 2026-09-08'].join('\n'))
    );
    expect(result.matter.entries).toEqual([
      { key: 'country', display: 'no' },
      { key: 'published', display: 'true' },
      { key: 'count', display: '01' },
      { key: 'date', display: '2026-09-08' }
    ]);
  });

  it('preserves document order, empty values, and comments', () => {
    const result = extractFrontMatter(
      wrap(['# heading comment', 'title: Hello  # inline', 'draft:', 'tags: [a, b]'].join('\n'))
    );
    expect(result.matter.entries.map(entry => entry.key)).toEqual(['title', 'draft', 'tags']);
    expect(result.matter.entries[0].display).toBe('Hello');
    expect(result.matter.entries[1].display).toBe('');
  });

  it('parses quoted strings and leaves hashes inside quotes', () => {
    const result = extractFrontMatter(wrap("title: \"Hello # world\"\nquote: 'it''s fine'"));
    expect(result.matter.entries).toEqual([
      { key: 'title', display: 'Hello # world' },
      { key: 'quote', display: "it's fine" }
    ]);
  });

  it('parses block and flow lists of scalars as comma-separated text', () => {
    const result = extractFrontMatter(
      wrap(['tags: [a, b]', 'aliases:', '  - one', '  - two'].join('\n'))
    );
    expect(result.matter.entries).toEqual([
      { key: 'tags', display: 'a, b' },
      { key: 'aliases', display: 'one, two' }
    ]);
  });

  it('renders one-level nested maps as indented text', () => {
    const result = extractFrontMatter(
      wrap(['author:', '  name: Ada', '  email: ada@example.com'].join('\n'))
    );
    expect(result.matter.entries).toEqual([
      { key: 'author', display: 'name: Ada\nemail: ada@example.com' }
    ]);
  });

  it('renders a deeper nested value as indented text without failing the card', () => {
    const result = extractFrontMatter(
      wrap(['title: Keep', 'config:', '  a:', '    b: 1'].join('\n'))
    );
    expect(result.matter.entries[0]).toEqual({ key: 'title', display: 'Keep' });
    expect(result.matter.entries[1].display).toBe('a:\n  b: 1');
  });

  it('parses literal and folded block scalars', () => {
    const result = extractFrontMatter(
      wrap(['literal: |', '  hello', '  world', 'folded: >', '  hello', '  world'].join('\n'))
    );
    expect(result.matter.entries).toEqual([
      { key: 'literal', display: 'hello\nworld' },
      { key: 'folded', display: 'hello world' }
    ]);
  });

  it('parses compact mappings in a sequence', () => {
    const result = extractFrontMatter(
      wrap(['authors:', '  - name: Ada', '    role: editor', '  - name: Bob'].join('\n'))
    );
    expect(result.matter.entries[0].display).toBe('- name: Ada\n  role: editor\n- name: Bob');
  });

  it('falls back to raw inner text when duplicate keys appear', () => {
    const result = extractFrontMatter(wrap('title: A\ntitle: B'));
    expect(result.matter.entries).toBeNull();
    expect(result.matter.raw).toContain('title: A');
    expect(result.body).toBe('\n# Body');
  });

  it('falls back to raw inner text for aliases, merge keys, tags, and tab indent', () => {
    expect(extractFrontMatter(wrap('title: &anchor Hello')).matter.entries).toBeNull();
    expect(extractFrontMatter(wrap('title: Hello\n<<: { nested: 1 }')).matter.entries).toBeNull();
    expect(extractFrontMatter(wrap('title: !!str Hello')).matter.entries).toBeNull();
    expect(extractFrontMatter(wrap('title: Hello\n\tindent: bad')).matter.entries).toBeNull();
  });

  it('falls back to raw inner text for an unclosed quote', () => {
    const result = extractFrontMatter(wrap('title: "Hello'));
    expect(result.matter.entries).toBeNull();
    expect(result.body).toBe('\n# Body');
  });
});

describe('frontMatterToMarkdown', () => {
  it('emits a GFM table with escaped cells', () => {
    const markdown = frontMatterToMarkdown({
      raw: '',
      entries: [
        { key: 'title', display: 'Hello *world* | x' },
        { key: 'tags', display: 'a, b' }
      ]
    });
    expect(markdown).toBe(
      [
        '| | |',
        '| --- | --- |',
        '| title | Hello &#42;world&#42; &#124; x |',
        '| tags | a, b |'
      ].join('\n')
    );
  });

  it('emits a fenced code block when parse failed', () => {
    expect(frontMatterToMarkdown({ raw: 'title: A\ntitle: B\n', entries: null })).toBe(
      '```\ntitle: A\ntitle: B\n```'
    );
  });

  it('places the table ahead of the Markdown body', () => {
    const merged = mergeFrontMatterMarkdown('\n# Body', {
      raw: '',
      entries: [{ key: 'title', display: 'Hello' }]
    });
    expect(merged.startsWith('| | |\n| --- | --- |\n| title | Hello |')).toBe(true);
    expect(merged.endsWith('# Body')).toBe(true);
  });
});
