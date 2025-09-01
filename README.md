# Academic Website

Modernized personal academic website with:

- Responsive design & dark mode toggle
- Animated sections and interactive infobox (hover reveal)
- D3.js knowledge graph fed by JSON data
- Automatic keyword frequency generation from BibTeX
- Image lazy loading & performance tweaks
- Basic SEO (sitemap.xml, robots.txt, JSON‑LD)

## Structure (key folders)

- `index.html`, `about.html`, `projects.html`, `publications.html` – main pages
- `css/` – custom styles (`agency_custom.css`)
- `js/knowledge_graph.js` – D3 knowledge graph loader / renderer
- `data/knowledge_graph.json` – base graph (nodes + links)
- `data/publications_keywords.json` – publication -> keywords data (auto-generated)
- `scripts/extract_keywords.py` – helper script to regenerate keyword JSON from BibTeX
- `Marcos.bib` – source BibTeX file of publications

## Regenerating publication keywords

Whenever `Marcos.bib` changes, regenerate `data/publications_keywords.json` so the knowledge graph reflects new work.

### 1. Requirements

- Python 3.8+ (no external packages needed)

### 2. Basic usage

```bash
python3 scripts/extract_keywords.py \
  --bib Marcos.bib \
  --out data/publications_keywords.json
```

This produces a JSON with shape:

```json
{
  "publications": [
    { "title": "...", "keywords": ["Knowledge Graphs", "Ontology", "..."] },
    ...
  ],
  "generatedFrom": "Marcos.bib",
  "totalPublications": 42
}
```

Reload the site (or refresh the browser) and the graph will scale node sizes based on updated keyword frequencies.

### 3. Filtering low-frequency noise

Use `--min-freq` to drop keywords that appear rarely across all publications:

```bash
python3 scripts/extract_keywords.py --min-freq 2
```

Only keywords whose global frequency ≥ 2 remain in each publication's keyword list.

### 4. Dry run to alternate file

If you want to inspect before overwriting the production file:

```bash
python3 scripts/extract_keywords.py --out data/publications_keywords_preview.json
```

Compare, then replace:

```bash
mv data/publications_keywords_preview.json data/publications_keywords.json
```

### 5. Updating the knowledge graph

`js/knowledge_graph.js` loads both `data/knowledge_graph.json` and `data/publications_keywords.json`. After regeneration:

1. Ensure the output filename is exactly `data/publications_keywords.json` (unless you also change the loader code).
2. Hard refresh the browser (Shift+Reload) to bypass cache.

### 6. Extending keyword extraction

Adjust heuristics in `scripts/extract_keywords.py`:
- Add multi-word phrases: edit `PHRASES` list.
- Normalize variants: edit `NORM` map.
- Add/remove stopwords: edit `STOPWORDS` set.

### 7. Automation (optional)

Add a simple cron (macOS/Linux):

```bash
crontab -e
# Weekly rebuild every Monday at 07:00
0 7 * * 1 cd /path/to/site && python3 scripts/extract_keywords.py --bib Marcos.bib --out data/publications_keywords.json
```

## Local preview

Use any static server (examples):

```bash
# Python
python3 -m http.server 8080
# or Node (if installed)
npx serve .
```
Then visit: http://localhost:8080

## License

See `LICENSE`.

---
Last updated: 2025-08-28
