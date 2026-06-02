import { describe, it, expect } from 'vitest';
import { extractSourceSymbols } from '../../../src/core/source/sourceSymbols.js';

function kindsByName(symbols) {
  return Object.fromEntries(symbols.map(s => [s.name, s.kind]));
}

describe('extractSourceSymbols', () => {
  it('parses TypeScript class/method/function/interface/type/enum', () => {
    const src = [
      'class Foo {',
      '  bar() {}',
      '}',
      'function baz() {}',
      'export const qux = () => {};',
      'interface Iface {}',
      'type T = string;',
      'enum E { A }'
    ].join('\n');
    const map = kindsByName(extractSourceSymbols(src, { language: 'typescript' }));
    expect(map.Foo).toBe('class');
    expect(map.bar).toBe('method');
    expect(map.baz).toBe('function');
    expect(map.qux).toBe('function');
    expect(map.Iface).toBe('interface');
    expect(map.T).toBe('type');
    expect(map.E).toBe('enum');
  });

  it('parses Python classes, methods and module functions', () => {
    const src = 'class A:\n    def m(self):\n        pass\ndef f():\n    pass';
    const map = kindsByName(extractSourceSymbols(src, { language: 'python' }));
    expect(map.A).toBe('class');
    expect(map.m).toBe('method');
    expect(map.f).toBe('function');
  });

  it('parses Go funcs, methods and types', () => {
    const src = 'type T struct {}\nfunc (s *S) M() {}\nfunc F() {}';
    const symbols = extractSourceSymbols(src, { language: 'go' });
    const kinds = symbols.map(s => s.kind);
    expect(kinds).toContain('type');
    expect(kinds).toContain('method');
    expect(kinds).toContain('function');
  });

  it('parses Rust functions, structs, enums and traits', () => {
    const src = 'pub fn f() {}\nstruct S {}\nenum E {}\ntrait Tr {}';
    const map = kindsByName(extractSourceSymbols(src, { language: 'rust' }));
    expect(map.f).toBe('function');
    expect(map.S).toBe('type');
    expect(map.E).toBe('enum');
    expect(map.Tr).toBe('interface');
  });

  it('parses Ruby and PHP and a brace language (Java)', () => {
    const ruby = kindsByName(extractSourceSymbols('class C\n  def m\n  end\nend\ndef top\nend', { language: 'ruby' }));
    expect(ruby.C).toBe('class');
    expect(ruby.m).toBe('method');
    expect(ruby.top).toBe('function');

    const php = kindsByName(extractSourceSymbols('<?php\nclass C {\n  public function m() {}\n}\nfunction f() {}', { language: 'php' }));
    expect(php.C).toBe('class');
    expect(php.m).toBe('method');
    expect(php.f).toBe('function');

    const java = kindsByName(extractSourceSymbols('class C {\n  public void m() {}\n}', { language: 'java' }));
    expect(java.C).toBe('class');
    expect(java.m).toBe('method');
  });

  it('returns [] for unsupported languages and caps at SYMBOL_LIMIT', () => {
    expect(extractSourceSymbols('whatever', { language: 'brainfuck' })).toEqual([]);
    const many = Array.from({ length: 1300 }, (_, i) => `def f${i}():\n    pass`).join('\n');
    expect(extractSourceSymbols(many, { language: 'python' })).toHaveLength(1200);
  });
});
