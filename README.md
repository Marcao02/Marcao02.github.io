# marcao02.github.io

Personal research website of Marcos Da Silveira (LIST, Luxembourg), served by GitHub Pages from `master`.

## Pages

- `index.html`: introduction, a topic graph that grows year by year, research themes, latest papers, selected projects
- `research.html`: the projects, filterable by theme (`projects.html` redirects here)
- `publications.html`: all papers with search, filters, a topic map, citation counts, DOI and PDF links
- `about.html`: biography, career timeline, supervision, service

Plain HTML, CSS and JavaScript modules (`css/site.css`, `js/`): no framework, nothing to install.
Light and dark themes follow the visitor's system setting; animations stop for visitors who ask for reduced motion.

## Data

| File | What it is |
|---|---|
| `data/Marcos.bib` | the publication list (main source) |
| `data/scholar.json` | the Google Scholar list: `[title, authors, venue, year, citations, id]` |
| `data/enrichment-overrides.json` | manual corrections to automatic matches, each with its reason under `_why` |
| `data/projects.json` | the projects shown on Home and Research |
| `data/publications.json` | generated: what the Publications page reads |

## Updating

After editing `Marcos.bib` or `scholar.json`, from the repository root:

```bash
sh scripts/sh/update_publications.sh
```

It merges the BibTeX with Google Scholar, finds DOIs, open-access PDFs and full author names in
OpenAlex and Semantic Scholar (answers cached in `data/cache/`, not committed), and regenerates
`data/publications.json` and the pages. Add `--refresh` to download OpenAlex again.

Page text (biography, career, research themes) lives in `scripts/py/build_pages.py`; after changing it, run
`python3 scripts/py/build_pages.py .`

## Local preview

```bash
python3 -m http.server 8080
```

Then open http://localhost:8080 (the pages load their data with `fetch`, so opening the files directly does not work).

## License

See `LICENSE`.
