#!/bin/sh
# Rebuild the publication data and the pages. Run from the repository root.
#   data/Marcos.bib                 your BibTeX (the main source)
#   data/scholar.json               Google Scholar list: [title, authors, venue, year, citations, id]
#   data/enrichment-overrides.json  manual corrections, each with its reason under "_why"
# DOIs, open-access PDFs and full author names come from OpenAlex and Semantic Scholar;
# their answers are cached in data/cache/ (not committed). --refresh downloads OpenAlex again.
set -e
mkdir -p data/cache
if [ "$1" = "--refresh" ] || [ ! -f data/cache/openalex.json ]; then
  for page in 1 2 3; do
    curl -sf "https://api.openalex.org/works?filter=author.id:A5000618048&per-page=100&page=$page&select=id,doi,title,publication_year,type,authorships,primary_location,best_oa_location,cited_by_count" -o "data/cache/openalex_$page.json"
  done
  python3 -I -c "import json,glob; json.dump([w for f in sorted(glob.glob('data/cache/openalex_*.json')) for w in json.load(open(f))['results']], open('data/cache/openalex.json','w'))"
fi
# 1. BibTeX + Scholar without enrichment: what enrich.py matches against.
python3 -I scripts/py/bib2json.py data/Marcos.bib data/cache/base.json data/scholar.json
# 2. DOIs, PDFs and full author names (applies data/enrichment-overrides.json last).
python3 -I scripts/py/enrich.py data/cache/base.json data/cache/openalex.json data/cache/enrichment.json
# 3. The data the pages read, then the pages.
python3 -I scripts/py/bib2json.py data/Marcos.bib data/publications.json data/scholar.json data/cache/enrichment.json
python3 -I scripts/py/build_pages.py .
