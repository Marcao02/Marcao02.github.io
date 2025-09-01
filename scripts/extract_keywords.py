#!/usr/bin/env python3
"""Extract keyword frequencies from a BibTeX file and generate JSON for the knowledge graph.

Usage:
  python scripts/extract_keywords.py \
      --bib Marcos.bib \
      --out data/publications_keywords.json

Heuristics:
  1. Detect predefined multi-word domain phrases (case-insensitive) in titles.
  2. Tokenize remaining words, filter stopwords / short tokens / numeric.
  3. Normalize singular/plural for a small ontology (e.g., Ontology/Ontologies -> Ontology).
  4. Keep top-N (default all with frequency >=1); optionally threshold with --min-freq.

This avoids external dependencies to keep the site portable.
"""

from __future__ import annotations
import argparse, json, re, unicodedata, sys, pathlib

PHRASES = [
    "knowledge graph", "knowledge graphs",
    "clinical guideline", "clinical guidelines",
    "semantic web", "semantic change",
    "machine learning", "data sharing",
    "explainable ai", "hybrid ai",
    "ontology", "ontologies",
    "mapping", "mappings",
    "recommendation", "recommendations",
    "e-health", "ehealth"
]

# Normalization map for singular/plural / variants
NORM = {
    "knowledge graphs": "Knowledge Graphs",
    "knowledge graph": "Knowledge Graphs",
    "clinical guidelines": "Clinical Guidelines",
    "clinical guideline": "Clinical Guidelines",
    "semantic web": "Semantic Web",
    "semantic change": "Semantic Change",
    "machine learning": "Machine Learning",
    "data sharing": "Data Sharing",
    "explainable ai": "Explainable AI",
    "hybrid ai": "Hybrid AI",
    "ontologies": "Ontology",
    "ontology": "Ontology",
    "mappings": "Mapping",
    "mapping": "Mapping",
    "recommendations": "Recommendation",
    "recommendation": "Recommendation",
    "e-health": "eHealth",
    "ehealth": "eHealth"
}

STOPWORDS = {
    'the','and','for','with','into','over','from','using','via','a','an','of','on','in','to','by','be','based','towards','toward','under','between','their','within','into','case','study','short','paper','approach','method','system','framework','platform','model','models','multi','multi-level','level','evaluation','analysis','support','maintenance','adaptive','dynamic','evolving','internal','external','generalizing','general','generalized','combining','construction','exploitation','driven','driven','formal','formalizing','formalisation','impact'
}

WORD_RE = re.compile(r"[A-Za-z][A-Za-z\-]{2,}")

def strip_accents(text: str) -> str:
    return ''.join(c for c in unicodedata.normalize('NFKD', text) if not unicodedata.combining(c))

def iter_bib_entries(bib_text: str):
    current = []
    depth = 0
    inside = False
    for line in bib_text.splitlines():
        if line.strip().startswith('@'):
            if current:
                yield '\n'.join(current)
                current = []
            inside = True
        if inside:
            current.append(line)
            depth += line.count('{') - line.count('}')
            if depth <= 0 and current:
                yield '\n'.join(current)
                current = []
                inside = False
    if current:
        yield '\n'.join(current)

def extract_title(entry: str) -> str|None:
    m = re.search(r"title\s*=\s*[{\"](.+?)[}\"]\s*,?", entry, flags=re.IGNORECASE|re.DOTALL)
    if not m:
        return None
    title = m.group(1).replace('\n',' ').strip()
    return re.sub(r"\s+"," ", title)

def phrase_scan(lower_title: str):
    found = []
    for p in PHRASES:
        if p in lower_title:
            found.append(NORM.get(p,p.title()))
    return found

def tokenize_remainder(title: str, used_phrases: list[str]):
    lower = strip_accents(title.lower())
    for p in PHRASES:
        lower = lower.replace(p, ' ')  # remove phrases already captured
    tokens = set()
    for w in WORD_RE.findall(lower):
        if w in STOPWORDS: continue
        if len(w) < 4: continue
        norm = NORM.get(w, w.capitalize())
        if norm.lower() in (u.lower() for u in used_phrases):
            continue
        tokens.add(norm)
    return sorted(tokens)

def build_publication_keywords(titles):
    pubs = []
    for t in titles:
        if not t: continue
        lt = strip_accents(t.lower())
        phrases = phrase_scan(lt)
        tokens = tokenize_remainder(t, phrases)
        keywords = phrases + tokens
        pubs.append({"title": t, "keywords": keywords})
    return pubs

def aggregate_keyword_freq(pubs):
    freq = {}
    for p in pubs:
        for k in p['keywords']:
            freq[k] = freq.get(k,0)+1
    return freq

def main():
    ap = argparse.ArgumentParser(description="Generate publications_keywords.json from BibTeX")
    ap.add_argument('--bib', default='Marcos.bib')
    ap.add_argument('--out', default='data/publications_keywords.json')
    ap.add_argument('--min-freq', type=int, default=1, help='Minimum freq to keep a keyword in per-publication list')
    args = ap.parse_args()

    bib_path = pathlib.Path(args.bib)
    if not bib_path.exists():
        print(f"Bib file not found: {bib_path}", file=sys.stderr)
        sys.exit(1)
    text = bib_path.read_text(encoding='utf-8', errors='replace')
    titles = [extract_title(e) for e in iter_bib_entries(text)]
    pubs = build_publication_keywords(titles)
    freq = aggregate_keyword_freq(pubs)

    # Filter per publication keywords by global min frequency threshold
    if args.min_freq > 1:
        for p in pubs:
            p['keywords'] = [k for k in p['keywords'] if freq.get(k,0) >= args.min_freq]

    out_path = pathlib.Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    payload = {"publications": pubs, "generatedFrom": str(bib_path), "totalPublications": len(pubs)}
    out_path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding='utf-8')
    print(f"Wrote {out_path} with {len(pubs)} publications and {len(freq)} unique keywords.")

if __name__ == '__main__':
    main()
