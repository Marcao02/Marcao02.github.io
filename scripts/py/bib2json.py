"""Convert a BibTeX file into the publications JSON used by the prototype.

Usage: bib2json.py <file.bib> <out.json> [scholar.json [enrichment.json]]
With a Google Scholar export ([title, authors, venue, year, cites, id] rows), matched papers
get their citation count and Scholar link, and papers only on Scholar are added.
"""
import json, re, sys

ACC = {"'": "\u0301", "`": "\u0300", "^": "\u0302", '"': "\u0308", "~": "\u0303", "c": "\u0327"}

def delatex(s):
    import unicodedata
    s = s.replace("``", "\u201c").replace("''", "\u201d").replace("--", "\u2013")
    def acc(m):
        return unicodedata.normalize("NFC", m.group(2) + ACC[m.group(1)])
    for _ in range(3):
        s = re.sub(r"\{\\([`'^\"~c])\{?\\?([a-zA-Z])\}?\}", acc, s)
        s = re.sub(r"\\([`'^\"~])\{?\\?([a-zA-Z])\}?", acc, s)
        s = re.sub(r"\\c\{([a-zA-Z])\}", lambda m: unicodedata.normalize("NFC", m.group(1) + "\u0327"), s)
    s = s.replace("\\&", "&").replace("\\_", "_").replace("\\%", "%")
    s = re.sub(r"\\[a-zA-Z]+\s*", "", s)
    s = s.replace("{", "").replace("}", "")
    return re.sub(r"\s+", " ", s).strip()

def parse(text):
    out, i = [], 0
    while True:
        m = re.compile(r"@(\w+)\s*\{\s*([^,]*),").search(text, i)
        if not m: break
        typ, key, j, depth = m.group(1).lower(), m.group(2), m.end(), 1
        k = j
        while depth and k < len(text):
            depth += {"{": 1, "}": -1}.get(text[k], 0); k += 1
        body, i = text[j:k-1], k
        fields, p = {}, 0
        for fm in re.finditer(r"(\w+)\s*=\s*", body):
            pass
        while True:
            fm = re.compile(r"\s*(\w+)\s*=\s*").match(body, p)
            if not fm: break
            name, q = fm.group(1).lower(), fm.end()
            if body[q] == "{":
                d, r = 1, q + 1
                while d: d += {"{": 1, "}": -1}.get(body[r], 0); r += 1
                val = body[q+1:r-1]
            elif body[q] == '"':
                r = body.index('"', q + 1) + 1; val = body[q+1:r-1]
            else:
                r = q
                while r < len(body) and body[r] not in ",\n": r += 1
                val = body[q:r]
            fields[name] = val.strip()
            p = body.find(",", r)
            if p < 0: break
            p += 1
        out.append((typ, key, fields))
    return out

def author_name(a):
    a = delatex(a)
    if "," in a:
        last, first = [x.strip() for x in a.split(",", 1)]
        a = f"{first} {last}"
    return a

THEMES = {
    "evolving-knowledge": r"fair\b|data harmoni|knowledge.sharing|management des connaissances|dykos|data integration|ontolog|knowledge graph|semantic annot|annotation|mapping|terminolog|\bKOS\b|linked|evolution|semantic web|rdf|knowledge organi|alignment|concept|SNOMED|UMLS",
    "systems": r"discrete|petri|manufactur|supervision|prognosis|control|prosthes|skull|internet service|evenements|événements|systemes discrets",
    "health": r"medic|clinic|health|patient|diabet|guideline|biomed|covid|disease|drug|care|multimorbid|ehr",
    "language-skills": r"skill|esco|word|language|sense|semantic change|histor|holocaust|llm|lexical|labou?r|education|text|survivor|testimon|translation|large language",
}
TOPICS = {
    "Ontology evolution": r"evolution|evolv|change|dynamic|version",
    "Semantic annotation": r"annotation",
    "Mapping maintenance": r"mapping|alignment",
    "Knowledge graphs": r"knowledge graph",
    "Ontologies": r"ontolog",
    "Clinical guidelines": r"guideline|multimorbid|clinical",
    "eHealth": r"health|medic|patient|diabet|biomed|covid",
    "Large language models": r"llm|large language|gpt|generative",
    "Word meaning": r"\bwords?\b|\bsense\b|lexical|semantic (shift|change)|meaning",
    "Skills & labour market": r"\bskills?\b|\besco\b|\blabou?r\b|\bjobs?\b|occupation",
    "Digital history": r"histor|holocaust|survivor|testimon",
    "Discrete event systems": r"discrete|petri|supervision|fault|control",
    "Collaborative systems": r"collaborat|web 2|social|\bagents?\b",
}
TYPE = {"article": "Journal", "inproceedings": "Conference", "incollection": "Book chapter", "misc": "Other", "phdthesis": "Thesis"}

def split_authors(field):
    """Split on "and"; a field with several commas and no "and" is a comma-separated list."""
    parts = re.split(r"\s+and\s+", field)
    if len(parts) == 1 and field.count(",") > 1:
        return [delatex(a).strip() for a in field.split(",") if a.strip()]
    return [author_name(a) for a in parts if a.strip()]

pubs = []
seen_keys: set[str] = set()
for typ, key, f in parse(open(sys.argv[1], encoding="utf-8").read()):
    title = delatex(f.get("title", "")).rstrip(".")
    venue = delatex(f.get("journal") or f.get("booktitle") or f.get("school") or f.get("publisher") or f.get("howpublished") or "")
    t = TYPE.get(typ, "Other")
    if "arxiv" in venue.lower(): t = "Preprint"
    hay = f"{title} {venue}"
    doi = f.get("doi", "").strip()
    url = f.get("url", "").strip()
    if not doi:
        m = re.search(r"arXiv:\s*(\d{4}\.\d{4,5})", venue)
        if m: url = url or f"https://arxiv.org/abs/{m.group(1)}"
    if not title or re.search(r"program committee|^wetice \d{4}$|^w2t \d{4}$", title, re.I) or not re.sub(r"\D", "", f.get("year", "")):
        continue
    # Some .bib keys are used by two different papers: make each id unique (file order decides).
    if key in seen_keys:
        print(f"duplicate .bib key {key}: second entry renamed {key}-2 ({title[:50]})")
        key = f"{key}-2"
    seen_keys.add(key)
    pubs.append({
        "id": key, "title": title,
        "authors": split_authors(f.get("author", "")),
        "year": int(re.sub(r"\D", "", f.get("year", "0"))[:4] or 0),
        "type": t, "venue": venue, "doi": doi, "url": url,
        "themes": [k for k, rx in THEMES.items() if re.search(rx, hay, re.I)],
        "topics": [k for k, rx in TOPICS.items() if re.search(rx, title, re.I)],
    })
def norm(t):
    import unicodedata
    t = "".join(c for c in unicodedata.normalize("NFD", t) if not unicodedata.combining(c))
    return re.sub(r"[^a-z0-9]", "", t.lower())

def classify(p):
    hay = f"{p['title']} {p['venue']}"
    p["themes"] = [k for k, rx in THEMES.items() if re.search(rx, hay, re.I)]
    p["topics"] = [k for k, rx in TOPICS.items() if re.search(rx, p["title"], re.I)]
    return p

# The same paper entered twice in the .bib: keep the entry with the most fields filled.
best = {}
for p in pubs:
    k = norm(p["title"])
    score = (bool(p["doi"]), len(p["venue"]), p["year"])
    if k not in best or score > best[k][0]:
        best[k] = (score, p)
# A title cut short mid-phrase ("... pour le", as Google Scholar sometimes stores it) is the
# same paper as the full title. A complete shorter title ("Complaint Ontology Pattern") is not.
CUT = {"le", "la", "les", "de", "des", "du", "pour", "the", "of", "for", "to", "and", "in", "a", "an", "with", "et"}
for k in sorted(best, key=len):
    last = best[k][1]["title"].lower().split()[-1].strip(".,:;")
    if last in CUT and any(o != k and o.startswith(k) for o in best):
        print(f"cut-off title merged into its full version: {best[k][1]['title']}")
        del best[k]
dropped = len(pubs) - len(best)
pubs = [p for _, p in best.values()]

SKIP = r"program committee|track committee|^wetice \d{4}$|^w2t \d{4}$|^organisation et conduite"
if len(sys.argv) > 3:
    by_title = {norm(p["title"]): p for p in pubs}
    added = 0
    for title, authors, venue, year, cites, sid in json.load(open(sys.argv[3], encoding="utf-8")):
        k = norm(title)
        hit = by_title.get(k) or next(
            (p for kk, p in by_title.items() if len(k) > 25 and (kk.startswith(k[:40]) or k.startswith(kk[:40]))), None)
        link = f"https://scholar.google.com/citations?view_op=view_citation&hl=en&user={sid.split(':')[0]}&citation_for_view={sid}"
        if hit:
            hit["cites"] = max(hit.get("cites", 0), cites)
            hit.setdefault("scholar", link)
            continue
        if not year or re.search(SKIP, title, re.I):
            continue
        venue = re.sub(r",\s*\d{4}$", "", venue).strip()
        t = ("Preprint" if "arxiv" in venue.lower() else "Patent" if "patent" in venue.lower()
             else "Journal" if re.search(r"\d+\s*\(\d+\)|, \d+-\d+$", venue) else "Conference")
        pubs.append(classify({
            "id": sid, "title": title.rstrip("."), "authors": [a.strip() for a in authors.split(",") if a.strip() != "..."],
            "year": year, "type": t, "venue": re.sub(r",\s*[\d-]+$", "", venue), "doi": "", "url": "",
            "cites": cites, "scholar": link, "source": "scholar",
        }))
        added += 1
    print(f"scholar: {added} added, {sum('cites' in p for p in pubs)} with citation counts")

if len(sys.argv) > 4:
    # DOIs, open-access PDFs and full author names found by enrich.py (OpenAlex, Semantic Scholar).
    extra = json.load(open(sys.argv[4], encoding="utf-8"))
    for p in pubs:
        e = extra.get(p["id"], {})
        if e.get("doi") and not p["doi"]:
            p["doi"] = e["doi"]
        if e.get("pdf"):
            p["pdf"] = e["pdf"]
        if e.get("url") and not p["url"]:
            p["url"] = e["url"]
        if e.get("authors") and (p.get("source") == "scholar" or len(e["authors"]) > len(p["authors"])):
            p["authors"] = e["authors"]
        if e.get("venue") and not p["venue"]:
            p["venue"] = e["venue"]
    print(f"enrichment: {sum(bool(p['doi']) for p in pubs)} with DOI, {sum('pdf' in p for p in pubs)} with PDF")

pubs.sort(key=lambda p: (-p["year"], p["title"]))
json.dump(pubs, open(sys.argv[2], "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(len(pubs), "pubs;", dropped, "duplicates dropped;", sum(1 for p in pubs if not p["themes"]), "without theme;", sum(1 for p in pubs if not p["topics"]), "without topic")
