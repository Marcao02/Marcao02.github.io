"""Generate the site's four pages, plus a redirect for the old projects.html, from one layout.

Usage: python3 scripts/py/build_pages.py .   (run from the repository root)
"""
import json
import sys
from pathlib import Path

OUT = Path(sys.argv[1])
SITE = "https://marcao02.github.io"
EMAIL = "marcos.dasilveira@list.lu"
ROLE = "Lead Researcher in knowledge graphs and hybrid AI"
PROFILES = [
    ("Google Scholar", "https://scholar.google.lu/citations?hl=en&user=tS76PyMAAAAJ"),
    ("ORCID", "https://orcid.org/0000-0002-2604-3645"),
    ("DBLP", "https://dblp.org/pid/s/Silveira:Marcos_Da"),
    ("ResearchGate", "https://www.researchgate.net/profile/Marcos_Silveira"),
]
CUR = ' aria-current="page"'
NAV = [("index.html", "Home"), ("research.html", "Research"), ("publications.html", "Publications"), ("about.html", "About")]

ICON = {
    "moon": '<svg class="moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>',
    "sun": '<svg class="sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" hidden><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
    "menu": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
    "pause": '<svg class="pause" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>',
    "play": '<svg class="play" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" hidden><path d="M7 5v14l12-7z"/></svg>',
    "copy": '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/></svg>',
}

PERSON = {
    "@context": "https://schema.org",
    "@type": "Person",
    "name": "Marcos Da Silveira",
    "jobTitle": ROLE,
    "worksFor": {"@type": "ResearchOrganization", "name": "Luxembourg Institute of Science and Technology (LIST)", "url": "https://www.list.lu/"},
    "alumniOf": {"@type": "CollegeOrUniversity", "name": "Université Toulouse III – Paul Sabatier"},
    "email": f"mailto:{EMAIL}",
    "image": f"{SITE}/img/portrait.jpg",
    "url": SITE,
    "sameAs": [u for _, u in PROFILES],
    "knowsAbout": ["Knowledge graphs", "Ontologies", "Semantic Web", "Hybrid AI", "Explainable AI", "eHealth", "Large language models"],
}


def contact_block() -> str:
    links = "".join(f'<li><a href="{u}">{n}</a></li>' for n, u in PROFILES)
    return f"""
<section class="section" id="contact" aria-labelledby="contact-title">
  <div class="wrap">
    <div class="contact reveal">
      <img class="portrait" src="img/portrait.jpg" alt="" width="96" height="96" loading="lazy">
      <div>
        <h2 id="contact-title">Working on discovering and evolving knowledge?</h2>
        <p>I welcome collaborations, project proposals and PhD or postdoc applications.</p>
        <ul class="profiles">{links}</ul>
      </div>
      <div class="email-row">
        <a class="btn" href="mailto:{EMAIL}">Email me</a>
        <button type="button" class="btn secondary" data-copy="{EMAIL}">{ICON["copy"]}Copy address</button>
        <span class="copied-msg" role="status"></span>
      </div>
    </div>
  </div>
</section>"""


def page(file: str, title: str, description: str, main: str, script: str | None, jsonld: list[dict]) -> None:
    nav = "".join(
        f'<li><a href="{h}"{CUR if h == file else ""}>{n}</a></li>' for h, n in NAV
    )
    url = SITE + ("/" if file == "index.html" else f"/{file}")
    full = title if file == "index.html" else f"{title} | Marcos Da Silveira"
    ld = "\n".join(f'<script type="application/ld+json">{json.dumps(d, ensure_ascii=False)}</script>' for d in jsonld)
    scripts = '<script type="module" src="js/site.js"></script>' + (
        f'\n<script type="module" src="js/{script}"></script>' if script else ""
    )
    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{full}</title>
<meta name="description" content="{description}">
<link rel="canonical" href="{url}">
<meta name="color-scheme" content="light dark">
<meta name="theme-color" content="#f3f5f8" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0f1830" media="(prefers-color-scheme: dark)">
<meta property="og:type" content="{"profile" if file in ("index.html", "about.html") else "website"}">
<meta property="og:title" content="{full}">
<meta property="og:description" content="{description}">
<meta property="og:url" content="{url}">
<meta name="twitter:card" content="summary">
<script>
  try {{ const t = localStorage.getItem("theme"); if (t) document.documentElement.dataset.theme = t; }} catch (e) {{}}
</script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Source+Serif+4:opsz,wght@8..60,500;8..60,600&display=swap">
<link rel="stylesheet" href="css/site.css">
<link rel="modulepreload" href="js/site.js">
{ld}
</head>
<body>
<a class="skip-link" href="#main">Skip to content</a>
<header class="site-header">
  <div class="wrap">
    <a class="site-name" href="index.html">Marcos Da Silveira</a>
    <nav class="site-nav" id="site-nav" aria-label="Main">
      <ul>{nav}</ul>
    </nav>
    <button type="button" class="icon-btn" data-theme-toggle aria-label="Switch theme">{ICON["moon"]}{ICON["sun"]}</button>
    <button type="button" class="icon-btn menu-btn" data-menu-toggle aria-expanded="false" aria-controls="site-nav" aria-label="Menu">{ICON["menu"]}</button>
  </div>
</header>
<main id="main">
{main}
</main>
<footer class="site-footer">
  <div class="wrap">
    <p>© <span data-year-now>2026</span> Marcos Da Silveira, Luxembourg Institute of Science and Technology</p>
    <ul>{"".join(f'<li><a href="{u}">{n}</a></li>' for n, u in PROFILES)}</ul>
  </div>
</footer>
{scripts}
</body>
</html>
"""
    (OUT / file).write_text(html, encoding="utf-8")


THEMES = [
    ("evolving-knowledge", "Knowledge that stays correct over time",
     "Ontologies, terminologies and knowledge graphs change with every release. I build methods that detect those changes and repair the mappings and annotations that depend on them.",
     [("DYNAMO", "dynamo"), ("ELISA", "elisa"), ("Dynaccurate", "dynaccurate"), ("MOKA", "moka")]),
    ("health", "Knowledge for health",
     "Formal models of clinical guidelines, conflict detection for patients with several conditions, adaptive treatment plans, and the architecture of Luxembourg's eHealth platform.",
     [("SACCOM", "saccom"), ("METIS", "metis"), ("HKG4COVID", "hkg4covid")]),
    ("language-skills", "Language, history and skills",
     "How the meaning of words shifts across decades of documents, and how skills data can be shared and matched with training, with LLMs and symbolic AI working together.",
     [("D4H", "d4h"), ("Data Space for Skills", "ds4skills"), ("AI Factory", "aifactory")]),
]

home = f"""
<section class="hero" aria-labelledby="hero-title">
  <canvas class="hero-graph" id="hero-graph" aria-hidden="true"></canvas>
  <div class="wrap">
    <h1 id="hero-title">Marcos Da Silveira</h1>
    <p class="role">{ROLE} at the Luxembourg Institute of Science and Technology (LIST)</p>
    <p class="pitch">I build knowledge that machines can reason with, and keep it correct as the world it describes changes: medical terminologies, the language of historical testimonies, the skills of Europe's workforce.</p>
    <div class="actions">
      <a class="btn" href="publications.html">Read the publications</a>
      <a class="btn secondary" href="#contact">Get in touch</a>
    </div>
  </div>
  <div class="hero-legend">
    <span class="year" id="graph-year" aria-hidden="true">2026</span>
    <p>Topics of my <span id="pub-total">102</span> papers, appearing in the year I first wrote about them</p>
    <button type="button" class="icon-btn" id="graph-pause" aria-pressed="false" aria-label="Pause the graph animation">{ICON["pause"]}{ICON["play"]}</button>
  </div>
</section>

<section class="section" aria-labelledby="themes-title">
  <div class="wrap">
    <h2 id="themes-title" class="reveal">What I work on</h2>
    <p class="lede reveal">Hybrid AI that combines formal reasoning with statistical learning, applied where knowledge changes fast and errors are costly.</p>
    <div class="themes">
      {"".join(f'''<article class="theme reveal">
        <h3><span class="dot" style="--c: var(--theme-{key})"></span>{name}</h3>
        <p>{text}</p>
        <ul>{"".join(f'<li><a href="research.html#{pid}">{pn}</a></li>' for pn, pid in projects)}</ul>
      </article>''' for key, name, text, projects in THEMES)}
    </div>
  </div>
</section>

<section class="section" aria-labelledby="latest-title">
  <div class="wrap">
    <div class="section-head reveal">
      <h2 id="latest-title">Latest publications</h2>
      <a href="publications.html">All publications</a>
    </div>
    <ol class="pub-list" id="latest-pubs" aria-live="off"></ol>
  </div>
</section>

<section class="section" aria-labelledby="projects-title">
  <div class="wrap">
    <div class="section-head reveal">
      <h2 id="projects-title">Selected projects</h2>
      <a href="research.html">All ten projects</a>
    </div>
    <ul class="project-list" id="selected-projects"></ul>
  </div>
</section>
{contact_block()}
"""

chips = '<button type="button" class="chip" data-theme-filter="all" aria-pressed="true">All <span class="count"></span></button>' + "".join(
    f'<button type="button" class="chip" data-theme-filter="{k}" aria-pressed="false"><span class="dot" style="--c: var(--theme-{k})"></span>{n} <span class="count"></span></button>'
    for k, n in [("evolving-knowledge", "Evolving knowledge"), ("health", "Health"), ("language-skills", "Language and skills")]
)
research = f"""
<div class="wrap page-head">
  <h1>Research and projects</h1>
  <p class="lede">Ten funded projects since 2011, from repairing medical terminology mappings to the European Data Space for Skills.</p>
  <div class="filters" role="group" aria-label="Filter projects by theme">
    <div class="filter-row">{chips}</div>
  </div>
  <p class="result-count" id="project-count" role="status"></p>
</div>
<section class="section" style="padding-top:1rem" aria-label="Projects">
  <div class="wrap"><ul class="project-list" id="project-list"></ul></div>
</section>
{contact_block()}
"""

publications = """
<div class="wrap page-head">
  <h1>Publications</h1>
  <p class="lede">Journal articles, conference papers and chapters since 1998, cited <span id="cite-total">1,125</span> times according to <a href="https://scholar.google.com/citations?user=tS76PyMAAAAJ&amp;hl=en">Google Scholar</a>. Titles link to the DOI or preprint when one is known.</p>
</div>
<section class="section" style="padding-top:0" aria-labelledby="graph-title">
  <div class="wrap">
    <h2 id="graph-title" class="visually-hidden">Topic map</h2>
    <div class="topic-graph-wrap">
      <canvas id="topic-graph" aria-hidden="true"></canvas>
      <p class="note">Topics sized by number of papers, linked when they share a paper. Select one to filter the list.</p>
    </div>
    <div class="filters">
      <label class="visually-hidden" for="pub-search">Search publications</label>
      <input class="search" id="pub-search" type="search" placeholder="Search titles, co-authors, venues" autocomplete="off">
      <div class="filter-row"><label class="label" for="pub-year">Year</label><select class="search" id="pub-year"></select><label class="label" for="pub-sort" style="margin-left:1rem">Sort</label><select class="search" id="pub-sort"><option value="new">Newest first</option><option value="cites">Most cited</option></select></div>
      <div class="filter-row" id="type-filters" role="group" aria-labelledby="type-label"><span class="label" id="type-label">Type</span></div>
      <div class="filter-row" id="theme-filters" role="group" aria-labelledby="theme-label"><span class="label" id="theme-label">Theme</span></div>
      <div class="filter-row" id="topic-filters" role="group" aria-labelledby="topic-label"><span class="label" id="topic-label">Topic</span></div>
    </div>
    <p class="result-count" id="pub-count" role="status"></p>
    <ol class="pub-list" id="pub-list" style="margin-top:1rem"></ol>
  </div>
</section>
"""

CAREER = [
    ("1998–2004", "Pontifical Catholic University of Paraná, Brazil", "Associate, then full professor.", ""),
    ("2000–2003", "PhD, Université Toulouse III, France", "Industrial informatics: fault recovery for discrete control systems with Petri nets.", ""),
    ("2004–2005", "LAAS-CNRS, Toulouse, France", "Postdoctoral researcher on fault detection for embedded aircraft systems, with Prof. Michel Combacau and Dr Louise Travé-Massuyès.", ""),
    ("2006–2008", "University of Luxembourg", "Scientific collaborator on the RESIST project: software architectures for eHealth, with Prof. Nicolas Guelfi.", ""),
    ("Since 2008", "Luxembourg Institute of Science and Technology (LIST)", "Researcher, now lead researcher. Designed the architecture of Luxembourg's eHealth platform, implemented by the eSanté Agency, and co-created the Dynaccurate technology behind a spin-off.", "now"),
]
PHD = [("Julio César dos Reis", "2014"), ("Emna Mezghani", "2016"), ("Veruska Zamborlini", "2017"), ("Silvio Cardoso", "2018"), ("Jader Martins Camboim de Sá", "ongoing")]
POSTDOC = [("Cédric Pruski", "2010"), ("Rodrigo Bonacin", "2011"), ("Asma Ben Abacha", "2014"), ("Bah-Duy Dinh", "2015"), ("Thu Huong Nguyen", "2024–2026")]
ACTIVITIES = [
    ("Chair, Data Integration in the Life Sciences (DILS)", "2017"),
    ("Guest editor, Future Generation Computer Systems: special issue on semantic technologies for the collaborative web", "2015"),
    ("Chair, Web2Touch track at WETICE", "2012, 2014"),
    ("Organiser, Medical Informatics Day workshops", "2012, 2014"),
    ("Chair, Web2Touch at NOTERE and at Web Intelligence", "2009, 2010"),
]
li = lambda rows: "".join(f"<li><span>{a}</span><span>{b}</span></li>" for a, b in rows)
about = f"""
<div class="wrap page-head"><h1>About</h1></div>
<section class="section" style="padding-top:1rem" aria-label="Biography">
  <div class="wrap bio">
    <div>
      <img class="portrait" src="img/portrait.jpg" alt="Portrait of Marcos Da Silveira" width="484" height="640">
      <dl class="facts">
        <dt>Position</dt><dd>{ROLE}, HUMOD group, LIST</dd>
        <dt>Based in</dt><dd>Esch-sur-Alzette, Luxembourg</dd>
        <dt>Email</dt><dd><a href="mailto:{EMAIL}">{EMAIL}</a></dd>
      </dl>
    </div>
    <div>
      <p class="lede">I work on making knowledge-based systems more collaborative and easier to understand, with hybrid AI that brings formal reasoning and statistical learning together.</p>
      <p>My research draws on Semantic Web technologies, machine learning, generative AI and formal reasoning. It has served projects that extract key information from multimodal sources, keep knowledge graphs accurate as they evolve, turn complex clinical guidelines into formal representations, and connect personal competences with industry needs and existing training.</p>
      <p>I designed the architecture of Luxembourg's eHealth platform, implemented by the eSanté Agency, which made secure sharing of medical data possible across the country. I was also a lead designer and developer of Dynaccurate, a technology for maintaining dynamic terminologies that led to a Luxembourg spin-off company.</p>
      <p>I hold a PhD in industrial informatics from the University of Toulouse (2003) and taught in Brazil and Luxembourg before joining LIST in 2008.</p>
      <ul class="interests" aria-label="Research interests">
        {"".join(f'<li class="tag">{t}</li>' for t in ["Ontologies", "Knowledge graphs", "Semantic technologies", "eHealth", "AI for education", "Large language models"])}
      </ul>
    </div>
  </div>
</section>

<section class="section" aria-labelledby="career-title">
  <div class="wrap">
    <h2 id="career-title" class="reveal">Career</h2>
    <ol class="timeline">
      {"".join(f'<li class="reveal {c}"><span class="when">{w}</span><h3>{t}</h3><p>{d}</p></li>' for w, t, d, c in CAREER)}
    </ol>
  </div>
</section>

<section class="section" aria-labelledby="supervision-title">
  <div class="wrap">
    <h2 id="supervision-title" class="reveal">Supervision</h2>
    <div class="two-col">
      <div class="reveal"><h3>PhD students</h3><ul class="plain-list">{li(PHD)}</ul></div>
      <div class="reveal"><h3>Postdoctoral researchers</h3><ul class="plain-list">{li(POSTDOC)}</ul></div>
    </div>
  </div>
</section>

<section class="section" aria-labelledby="activities-title">
  <div class="wrap">
    <h2 id="activities-title" class="reveal">Service to the community</h2>
    <ul class="plain-list reveal" style="max-width:52rem">{li(ACTIVITIES)}</ul>
  </div>
</section>
{contact_block()}
"""

OUT.mkdir(parents=True, exist_ok=True)
page("index.html", "Marcos Da Silveira, knowledge graphs and hybrid AI",
     "Marcos Da Silveira, lead researcher at LIST in Luxembourg: knowledge graphs, ontology evolution, hybrid and explainable AI, eHealth and skills data.",
     home, "home.js", [PERSON])
page("research.html", "Research and projects",
     "Ten research projects led or co-led by Marcos Da Silveira at LIST: evolving knowledge graphs, clinical knowledge, digital history and skills data.",
     research, "research.js", [])
page("publications.html", "Publications",
     "All publications of Marcos Da Silveira, searchable and filterable by year, type, theme and topic.",
     publications, "publications.js", [])
page("about.html", "About",
     "Biography, career, supervision and community service of Marcos Da Silveira, lead researcher at LIST, Luxembourg.",
     about, None, [PERSON])
# The old site had projects.html: keep its links working.
(OUT / "projects.html").write_text("""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Research and projects | Marcos Da Silveira</title>
<link rel="canonical" href="https://marcao02.github.io/research.html">
<meta http-equiv="refresh" content="0; url=research.html">
<meta name="robots" content="noindex">
</head>
<body>
<p>This page has moved to <a href="research.html">Research and projects</a>.</p>
<script>location.replace("research.html" + location.hash);</script>
</body>
</html>
""", encoding="utf-8")
print("built", sorted(p.name for p in OUT.glob("*.html")))
