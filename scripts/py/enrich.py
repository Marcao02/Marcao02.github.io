"""Find DOIs, open-access PDFs and full author lists for the publications, from OpenAlex then Semantic Scholar.

Usage: enrich.py <publications.json> <openalex.json> <out enrichment.json> [--no-s2]
openalex.json is the author's works from api.openalex.org (see the curl in the README notes).
The output maps a publication id to the fields found and where they came from; bib2json.py
applies it. Semantic Scholar answers are cached in cache/s2/ so a re-run asks again only for misses.
"""
import json
import re
import sys
import time
import unicodedata
import urllib.parse
import urllib.request
from difflib import SequenceMatcher
from pathlib import Path


def norm(t: str) -> str:
    t = "".join(c for c in unicodedata.normalize("NFD", t or "") if not unicodedata.combining(c))
    return re.sub(r"[^a-z0-9]", "", t.lower())


def same(a: str, b: str) -> float:
    a, b = norm(a), norm(b)
    if not a or not b:
        return 0.0
    if a == b:
        return 1.0
    if len(a) > 30 and len(b) > 30 and (a.startswith(b) or b.startswith(a)):
        return 0.97
    return SequenceMatcher(None, a, b).ratio()


def clean_doi(d: str | None) -> str:
    return re.sub(r"^https?://(dx\.)?doi\.org/", "", d or "", flags=re.I).strip()


pubs = json.load(open(sys.argv[1], encoding="utf-8"))
works = json.load(open(sys.argv[2], encoding="utf-8"))
out: dict[str, dict] = {}
report = []

# One-to-one matching: the best (paper, work) pairs first, so near-twin titles (a preprint and
# its journal version, a short and a long paper) each keep their own record.
pairs = []
for p in pubs:
    for w in works:
        yw = w.get("publication_year") or 0
        if p["year"] and yw and abs(p["year"] - yw) > 2:
            continue
        s = same(p["title"], w.get("title") or "")
        if s >= 0.9:
            pairs.append((s, -abs((p["year"] or yw) - (yw or p["year"])), p["id"], w["id"]))
pairs.sort(reverse=True)
by_pub = {p["id"]: p for p in pubs}
by_work = {w["id"]: w for w in works}
taken_p, taken_w, chosen = set(), set(), []
for s, _, pid, wid in pairs:
    if pid in taken_p or wid in taken_w:
        continue
    taken_p.add(pid); taken_w.add(wid)
    chosen.append((by_pub[pid], by_work[wid], s))

for p, best, score in chosen:
    found = {"source": "openalex", "match": round(score, 3), "openalex": best["id"]}
    doi = clean_doi(best.get("doi"))
    # OpenAlex sometimes gives the DOI of the proceedings volume; only keep a DOI of the paper itself.
    if doi and not p.get("doi"):
        found["doi"] = doi
    pdf = (best.get("best_oa_location") or {}).get("pdf_url")
    if pdf:
        found["pdf"] = pdf
    names = [a["author"]["display_name"] for a in best.get("authorships", [])]
    if names:
        found["authors"] = names
    venue = ((best.get("primary_location") or {}).get("source") or {}).get("display_name")
    if venue:
        found["venue"] = venue
    out[p["id"]] = found
    if score < 1:
        report.append(f"  {score:.2f}  {p['title'][:60]}  ~  {(best.get('title') or '')[:60]}")

print(f"OpenAlex: {len(out)} matched, {sum('doi' in v for v in out.values())} new DOIs, {sum('pdf' in v for v in out.values())} PDFs")
print("Fuzzy matches to review:\n" + "\n".join(report))

if "--no-s2" not in sys.argv:
    cache = Path(sys.argv[3]).parent / "s2"
    cache.mkdir(parents=True, exist_ok=True)
    fields = "title,year,externalIds,openAccessPdf,authors,venue"
    todo = [p for p in pubs if not p.get("doi") and "doi" not in out.get(p["id"], {})]
    hits = 0
    for p in todo:
        f = cache / (norm(p["title"])[:80] + ".json")
        if not f.exists():
            url = "https://api.semanticscholar.org/graph/v1/paper/search/match?" + urllib.parse.urlencode(
                {"query": p["title"], "fields": fields})
            for attempt in range(4):
                try:
                    with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "publication-list-builder"}), timeout=20) as r:
                        f.write_text(r.read().decode())
                    break
                except urllib.error.HTTPError as e:
                    if e.code == 404:
                        f.write_text('{"data": []}')
                        break
                    time.sleep(3 * (attempt + 1))  # 429: rate limited
            time.sleep(1.1)
        data = (json.loads(f.read_text()) if f.exists() else {}).get("data") or []
        if not data:
            continue
        d = data[0]
        s = same(p["title"], d.get("title") or "")
        if s < 0.9 or (p["year"] and d.get("year") and abs(p["year"] - d["year"]) > 2):
            continue
        found = out.setdefault(p["id"], {"source": "semanticscholar"})
        found["s2"] = f"https://www.semanticscholar.org/paper/{d['paperId']}"
        doi = (d.get("externalIds") or {}).get("DOI")
        arxiv = (d.get("externalIds") or {}).get("ArXiv")
        if doi:
            found["doi"] = doi
            found["doi_source"] = "semanticscholar"
            hits += 1
        elif arxiv and not p.get("url"):
            found["url"] = f"https://arxiv.org/abs/{arxiv}"
        pdf = (d.get("openAccessPdf") or {}).get("url")
        if pdf and "pdf" not in found:
            found["pdf"] = pdf
        if d.get("authors") and "authors" not in found:
            found["authors"] = [a["name"] for a in d["authors"]]
        if s < 1:
            print(f"  S2 {s:.2f}  {p['title'][:60]}  ~  {d.get('title', '')[:60]}")
    print(f"Semantic Scholar: asked about {len(todo)}, {hits} new DOIs")

overrides = Path(sys.argv[3]).parent.parent / "enrichment-overrides.json"
if overrides.exists():
    for pid, fields in json.loads(overrides.read_text(encoding="utf-8")).items():
        if pid.startswith("_"):
            continue
        rec = out.setdefault(pid, {})
        for k, v in fields.items():
            if v is None:
                rec.pop(k, None)
            else:
                rec[k] = v
    print(f"applied {overrides.name}")
json.dump(out, open(sys.argv[3], "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(f"{sum(1 for p in pubs if p.get('doi') or 'doi' in out.get(p['id'], {}))} of {len(pubs)} publications now have a DOI")
