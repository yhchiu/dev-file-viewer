const SYMBOL_LIMIT = 1200;

export function extractSourceSymbols(sourceText = '', options = {}) {
  const language = normalizeSymbolLanguage(options.language || '');
  const lines = String(sourceText || '').replace(/\r\n?/g, '\n').split('\n');

  switch (language) {
    case 'javascript':
    case 'typescript':
      return extractJavaScriptSymbols(lines);
    case 'python':
      return extractPythonSymbols(lines);
    case 'go':
      return extractGoSymbols(lines);
    case 'java':
    case 'csharp':
    case 'kotlin':
    case 'swift':
      return extractBraceLanguageSymbols(lines, language);
    case 'php':
      return extractPhpSymbols(lines);
    case 'ruby':
      return extractRubySymbols(lines);
    case 'rust':
      return extractRustSymbols(lines);
    default:
      return [];
  }
}

export function buildSourceSymbolTree(symbols = [], rootElement) {
  const byId = new Map();
  const roots = [];

  for (const symbol of symbols.slice(0, SYMBOL_LIMIT)) {
    const element = rootElement?.querySelector?.(`#${CSS.escape(symbol.anchorId || `L${symbol.line}`)}`) || null;
    if (!element) continue;

    const node = {
      id: symbol.id,
      anchorId: symbol.anchorId || `L${symbol.line}`,
      kind: 'source-symbol',
      symbolKind: symbol.kind,
      text: symbol.text,
      detail: symbol.detail || '',
      path: symbol.text,
      line: symbol.line,
      element,
      level: 1,
      parentIds: [],
      children: [],
      hasChildren: false
    };

    byId.set(node.id, node);

    const parent = symbol.parentId ? byId.get(symbol.parentId) : null;
    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const nodes = [];
  function walk(items, level, parentIds) {
    for (const node of items) {
      node.level = Math.min(level, 6);
      node.parentIds = [...parentIds];
      node.hasChildren = Boolean(node.children.length);
      nodes.push(node);
      if (node.children.length) walk(node.children, level + 1, [...parentIds, node.id]);
    }
  }

  walk(roots, 1, []);

  return { nodes, roots, byId, symbolNodes: nodes.filter(node => node.kind === 'source-symbol') };
}

function normalizeSymbolLanguage(language = '') {
  const value = String(language || '').toLowerCase();
  if (['js', 'jsx', 'mjs', 'cjs'].includes(value)) return 'javascript';
  if (['ts', 'tsx'].includes(value)) return 'typescript';
  if (['py'].includes(value)) return 'python';
  if (['cs'].includes(value)) return 'csharp';
  if (['kt', 'kts'].includes(value)) return 'kotlin';
  if (['rs'].includes(value)) return 'rust';
  if (['rb'].includes(value)) return 'ruby';
  return value;
}

function makeSymbolId(kind, name, line) {
  return `symbol-${line}-${kind}-${slug(name)}`;
}

function addSymbol(list, kind, name, line, parentId = '', detail = '') {
  if (!name || list.length >= SYMBOL_LIMIT) return null;
  const text = formatSymbolText(kind, name);
  const symbol = {
    id: makeSymbolId(kind, text, line),
    anchorId: `L${line}`,
    kind,
    name,
    text,
    detail,
    line,
    parentId
  };
  list.push(symbol);
  return symbol;
}

function formatSymbolText(kind, name) {
  if (kind === 'method') return name;
  return name;
}

function slug(value = '') {
  return String(value || 'symbol')
    .toLowerCase()
    .replace(/[^a-z0-9_$.-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'symbol';
}

function stripLineComment(line = '') {
  return String(line || '').replace(/\/\/.*$/, '').replace(/#.*$/, '');
}

function countChar(value = '', char) {
  return [...String(value || '')].filter(candidate => candidate === char).length;
}

function braceDelta(line = '') {
  const clean = String(line || '')
    .replace(/(['"`])(?:\\.|(?!\1).)*\1/g, '')
    .replace(/\/\/.*$/, '');
  return countChar(clean, '{') - countChar(clean, '}');
}

function extractJavaScriptSymbols(lines) {
  const symbols = [];
  const stack = [];
  let depth = 0;

  lines.forEach((rawLine, index) => {
    const lineNumber = index + 1;
    const line = rawLine.trim();

    while (stack.length && depth <= stack.at(-1).startDepth) stack.pop();
    const parent = stack.findLast(item => ['class', 'interface'].includes(item.kind));

    let match = line.match(/^(?:export\s+default\s+|export\s+)?(?:abstract\s+)?class\s+([A-Za-z_$][\w$]*)/);
    if (match) {
      const symbol = addSymbol(symbols, 'class', match[1], lineNumber, parent?.id || '');
      if (symbol) stack.push({ ...symbol, startDepth: depth, kind: 'class' });
    } else if ((match = line.match(/^(?:export\s+)?interface\s+([A-Za-z_$][\w$]*)/))) {
      const symbol = addSymbol(symbols, 'interface', match[1], lineNumber, parent?.id || '');
      if (symbol) stack.push({ ...symbol, startDepth: depth, kind: 'interface' });
    } else if ((match = line.match(/^(?:export\s+)?type\s+([A-Za-z_$][\w$]*)\s*=/))) {
      addSymbol(symbols, 'type', match[1], lineNumber, parent?.id || '');
    } else if ((match = line.match(/^(?:export\s+)?enum\s+([A-Za-z_$][\w$]*)/))) {
      addSymbol(symbols, 'enum', match[1], lineNumber, parent?.id || '');
    } else if ((match = line.match(/^(?:export\s+)?(?:async\s+)?function\*?\s+([A-Za-z_$][\w$]*)/))) {
      addSymbol(symbols, 'function', match[1], lineNumber, '');
    } else if ((match = line.match(/^(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:function\b|\([^)]*\)\s*=>|[A-Za-z_$][\w$]*\s*=>)/))) {
      addSymbol(symbols, 'function', match[1], lineNumber, '');
    } else if (parent && (match = line.match(/^(?:public\s+|private\s+|protected\s+|static\s+|async\s+|override\s+|readonly\s+|get\s+|set\s+)*([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*(?::\s*[^={]+)?[{;]?/))) {
      const name = match[1];
      if (!RESERVED_JS_WORDS.has(name)) addSymbol(symbols, 'method', name, lineNumber, parent.id);
    }

    depth += braceDelta(rawLine);
  });

  return symbols;
}

const RESERVED_JS_WORDS = new Set(['if', 'for', 'while', 'switch', 'catch', 'function', 'constructor']);

function extractPythonSymbols(lines) {
  const symbols = [];
  const stack = [];

  lines.forEach((rawLine, index) => {
    const lineNumber = index + 1;
    if (!rawLine.trim() || rawLine.trimStart().startsWith('#')) return;

    const indent = rawLine.match(/^\s*/)?.[0]?.length || 0;
    while (stack.length && indent <= stack.at(-1).indent) stack.pop();

    let match = rawLine.match(/^\s*class\s+([A-Za-z_][\w]*)/);
    if (match) {
      const parent = stack.at(-1);
      const symbol = addSymbol(symbols, 'class', match[1], lineNumber, parent?.kind === 'class' ? parent.id : '');
      if (symbol) stack.push({ ...symbol, indent, kind: 'class' });
      return;
    }

    match = rawLine.match(/^\s*(?:async\s+)?def\s+([A-Za-z_][\w]*)/);
    if (match) {
      const parent = stack.findLast(item => item.kind === 'class');
      const symbol = addSymbol(symbols, parent ? 'method' : 'function', match[1], lineNumber, parent?.id || '');
      if (symbol) stack.push({ ...symbol, indent, kind: 'function' });
    }
  });

  return symbols;
}

function extractGoSymbols(lines) {
  const symbols = [];

  lines.forEach((rawLine, index) => {
    const lineNumber = index + 1;
    const line = rawLine.trim();

    let match = line.match(/^type\s+([A-Za-z_]\w*)\s+(?:struct|interface)\b/);
    if (match) {
      addSymbol(symbols, 'type', match[1], lineNumber);
      return;
    }

    match = line.match(/^func\s+(?:\(([^)]+)\)\s*)?([A-Za-z_]\w*)\s*\(/);
    if (match) {
      const receiver = match[1]?.replace(/\s+/g, ' ').trim();
      const name = receiver ? `${receiver}.${match[2]}` : match[2];
      addSymbol(symbols, receiver ? 'method' : 'function', name, lineNumber);
    }
  });

  return symbols;
}

function extractBraceLanguageSymbols(lines, language) {
  const symbols = [];
  const stack = [];
  let depth = 0;

  lines.forEach((rawLine, index) => {
    const lineNumber = index + 1;
    const line = stripLineComment(rawLine).trim();

    while (stack.length && depth <= stack.at(-1).startDepth) stack.pop();
    const parent = stack.findLast(item => ['class', 'interface', 'type'].includes(item.kind));

    let match = line.match(/\b(?:class|interface|enum|record|struct|object|protocol)\s+([A-Za-z_][\w$]*)/);
    if (match) {
      const kind = /interface|protocol/.test(line) ? 'interface' : /enum/.test(line) ? 'enum' : 'class';
      const symbol = addSymbol(symbols, kind, match[1], lineNumber, parent?.id || '');
      if (symbol) stack.push({ ...symbol, startDepth: depth, kind });
    } else if (parent && (match = line.match(/^(?:@\w+(?:\([^)]*\))?\s*)*(?:(?:public|private|protected|internal|static|final|open|override|abstract|virtual|async|suspend|mutating|func|fun|def|native|synchronized|sealed|readonly|partial)\s+)*(?:[\w<>\[\],.?]+\s+)+([A-Za-z_][\w$]*)\s*\([^;{}]*\)\s*(?:throws\s+\w+\s*)?[{;]?/))) {
      const name = match[1];
      if (!RESERVED_METHOD_WORDS.has(name)) addSymbol(symbols, 'method', name, lineNumber, parent.id);
    } else if (language === 'swift' && (match = line.match(/^(?:public|private|internal|open|static|mutating|override\s+)*func\s+([A-Za-z_]\w*)\s*\(/))) {
      addSymbol(symbols, parent ? 'method' : 'function', match[1], lineNumber, parent?.id || '');
    } else if (language === 'kotlin' && (match = line.match(/^(?:public|private|internal|protected|override|suspend\s+)*fun\s+([A-Za-z_]\w*)\s*\(/))) {
      addSymbol(symbols, parent ? 'method' : 'function', match[1], lineNumber, parent?.id || '');
    }

    depth += braceDelta(rawLine);
  });

  return symbols;
}

const RESERVED_METHOD_WORDS = new Set(['if', 'for', 'while', 'switch', 'catch', 'return', 'new']);

function extractPhpSymbols(lines) {
  const symbols = [];
  const stack = [];
  let depth = 0;

  lines.forEach((rawLine, index) => {
    const lineNumber = index + 1;
    const line = stripLineComment(rawLine).trim();
    while (stack.length && depth <= stack.at(-1).startDepth) stack.pop();
    const parent = stack.findLast(item => item.kind === 'class');

    let match = line.match(/^(?:abstract\s+|final\s+)?class\s+([A-Za-z_]\w*)/);
    if (match) {
      const symbol = addSymbol(symbols, 'class', match[1], lineNumber);
      if (symbol) stack.push({ ...symbol, startDepth: depth, kind: 'class' });
    } else if ((match = line.match(/^(?:public|private|protected|static|final|abstract|\s)*function\s+([A-Za-z_]\w*)/))) {
      addSymbol(symbols, parent ? 'method' : 'function', match[1], lineNumber, parent?.id || '');
    }

    depth += braceDelta(rawLine);
  });

  return symbols;
}

function extractRubySymbols(lines) {
  const symbols = [];
  const stack = [];

  lines.forEach((rawLine, index) => {
    const lineNumber = index + 1;
    const indent = rawLine.match(/^\s*/)?.[0]?.length || 0;
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) return;

    while (stack.length && indent <= stack.at(-1).indent && /^end\b/.test(line)) stack.pop();

    let match = line.match(/^class\s+([A-Za-z_]\w*(?:::[A-Za-z_]\w*)*)/);
    if (match) {
      const symbol = addSymbol(symbols, 'class', match[1], lineNumber);
      if (symbol) stack.push({ ...symbol, indent, kind: 'class' });
      return;
    }

    match = line.match(/^module\s+([A-Za-z_]\w*(?:::[A-Za-z_]\w*)*)/);
    if (match) {
      const symbol = addSymbol(symbols, 'module', match[1], lineNumber);
      if (symbol) stack.push({ ...symbol, indent, kind: 'module' });
      return;
    }

    match = line.match(/^def\s+(?:self\.)?([A-Za-z_]\w*[!?=]?)/);
    if (match) {
      const parent = stack.findLast(item => ['class', 'module'].includes(item.kind));
      addSymbol(symbols, parent ? 'method' : 'function', match[1], lineNumber, parent?.id || '');
    }
  });

  return symbols;
}

function extractRustSymbols(lines) {
  const symbols = [];
  lines.forEach((rawLine, index) => {
    const lineNumber = index + 1;
    const line = stripLineComment(rawLine).trim();

    let match = line.match(/^(?:pub\s+)?(?:async\s+)?fn\s+([A-Za-z_]\w*)/);
    if (match) {
      addSymbol(symbols, 'function', match[1], lineNumber);
      return;
    }

    match = line.match(/^(?:pub\s+)?(?:struct|enum|trait)\s+([A-Za-z_]\w*)/);
    if (match) {
      const kind = line.includes('trait ') ? 'interface' : line.includes('enum ') ? 'enum' : 'type';
      addSymbol(symbols, kind, match[1], lineNumber);
    }
  });
  return symbols;
}
