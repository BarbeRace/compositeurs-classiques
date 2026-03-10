// scripts/parse-md-to-json.js
// Usage: node scripts/parse-md-to-json.js
// Output: writes src/data/composers.json

const fs = require('fs');
const path = require('path');
const MarkdownIt = require('markdown-it');

const mdPath = path.resolve(__dirname, '../src/data/composers.md');
const outPath = path.resolve(__dirname, '../src/data/composers.json');

function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9\u00C0-\u017F]+/g, '-').replace(/^-+|-+$/g, '');
}

function parseMarkdown(md) {
  const mdParser = new MarkdownIt();
  const tokens = mdParser.parse(md, {});
  const nodes = [];
  const edges = [];
  let currentEra = null;
  let currentComposer = null;

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];

    if (t.type === 'heading_open') {
      const level = Number(t.tag.slice(1));
      const contentToken = tokens[i + 1];
      const text = contentToken && contentToken.type === 'inline' ? contentToken.content.trim() : '';
      if (level === 2) {
        // Era heading (##)
        currentEra = text.replace(/\d{4}-\d{2,4}/, '').trim(); // remove year range if present
        currentComposer = null;
        // create era node
        const eraId = `era:${slugify(currentEra || 'unknown')}`;
        if (!nodes.find(n => n.id === eraId)) {
          nodes.push({ id: eraId, label: currentEra || 'Époque', era: 'meta', movement: '', works: [], image: '' });
        }
      } else if (level === 3) {
        // Composer heading (###)
        currentComposer = text;
        const composerId = slugify(currentComposer);
        // create composer node
        if (!nodes.find(n => n.id === composerId)) {
          nodes.push({
            id: composerId,
            label: currentComposer,
            era: currentEra || '',
            movement: '',
            works: [],
            image: ''
          });
        }
        // create edge composer -> era
        if (currentEra) {
          edges.push({ source: composerId, target: `era:${slugify(currentEra)}`, weight: 0.6 });
        }
      }
    }

    // capture list items (works) when currentComposer is set
    if (t.type === 'bullet_list_open' && currentComposer) {
      // iterate subsequent tokens until bullet_list_close
      let j = i + 1;
      while (j < tokens.length && tokens[j].type !== 'bullet_list_close') {
        if (tokens[j].type === 'list_item_open') {
          // next inline token contains the text
          const inline = tokens[j + 2]; // pattern: list_item_open -> paragraph_open -> inline
          if (inline && inline.type === 'inline') {
            const text = inline.content.trim();
            const composerId = slugify(currentComposer);
            const node = nodes.find(n => n.id === composerId);
            if (node) {
              node.works.push(text);
            }
          }
        }
        j++;
      }
    }
  }

  // Optionally: connect composers within same era (lightweight)
  const eraGroups = {};
  nodes.forEach(n => {
    if (n.era && !n.era.startsWith('meta')) {
      eraGroups[n.era] = eraGroups[n.era] || [];
      eraGroups[n.era].push(n.id);
    }
  });
  Object.values(eraGroups).forEach(group => {
    for (let i = 0; i < group.length - 1; i++) {
      edges.push({ source: group[i], target: group[i + 1], weight: 0.2 });
    }
  });

  return { nodes, edges };
}

function main() {
  if (!fs.existsSync(mdPath)) {
    console.error('Markdown source not found:', mdPath);
    process.exit(1);
  }
  const md = fs.readFileSync(mdPath, 'utf8');
  const graph = parseMarkdown(md);
  fs.writeFileSync(outPath, JSON.stringify(graph, null, 2), 'utf8');
  console.log('Wrote', outPath, 'nodes:', graph.nodes.length, 'edges:', graph.edges.length);
}

main();
