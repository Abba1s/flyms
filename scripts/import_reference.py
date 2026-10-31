"""One-off: convert the decoded reference dataset into FlyMS seed CSVs.

Input is the JSON written by decode_reference_data.py. Output goes to
supabase/seed/{universities,programs,intakes}.csv. Every imported program has an
empty last_verified_at: it must be re-checked against the official page.

Usage: python3 -I scripts/import_reference.py <decoded-reference.json>
(The reference file is kept locally and is not part of the repository.)
"""
import csv
import json
import re
import sys
import unicodedata
from pathlib import Path

SEED = Path(__file__).resolve().parent.parent / "supabase" / "seed"

CITY_STATE = {
    "Weimar": "Thuringia", "Ilmenau": "Thuringia",
    "Cottbus": "Brandenburg", "Potsdam": "Brandenburg",
    "Deggendorf": "Bavaria", "Erlangen": "Bavaria", "Hof": "Bavaria", "Würzburg": "Bavaria",
    "Ingolstadt": "Bavaria", "Bamberg": "Bavaria", "Bayreuth": "Bavaria", "Passau": "Bavaria",
    "Regensburg": "Bavaria",
    "Fulda": "Hesse", "Marburg": "Hesse", "Darmstadt": "Hesse", "Kassel": "Hesse",
    "Heidelberg": "Baden-Württemberg", "Freiburg": "Baden-Württemberg",
    "Mannheim": "Baden-Württemberg", "Stuttgart": "Baden-Württemberg",
    "Sankt Augustin": "North Rhine-Westphalia", "Paderborn": "North Rhine-Westphalia",
    "Kleve": "North Rhine-Westphalia", "Dortmund": "North Rhine-Westphalia",
    "Bonn": "North Rhine-Westphalia", "Siegen": "North Rhine-Westphalia",
    "Kiel": "Schleswig-Holstein", "Lübeck": "Schleswig-Holstein",
    "Osnabrück": "Lower Saxony", "Braunschweig": "Lower Saxony",
    "Clausthal-Zellerfeld": "Lower Saxony", "Göttingen": "Lower Saxony",
    "Hildesheim": "Lower Saxony",
    "Magdeburg": "Saxony-Anhalt",
    "Kaiserslautern": "Rhineland-Palatinate", "Trier": "Rhineland-Palatinate",
    "Koblenz": "Rhineland-Palatinate",
    "Saarbrücken": "Saarland",
    "Berlin": "Berlin", "Hamburg": "Hamburg", "Bremen": "Bremen",
    "Chemnitz": "Saxony",
}

# (pattern on course name, field override or None, specialization slugs)
SPEC_RULES = [
    (r"digital engineering", "engineering", ["digital-engineering"]),
    (r"mathematical model", "natural-sciences", ["mathematics", "scientific-computing"]),
    (r"cognitive science", None, ["cognitive-science", "artificial-intelligence"]),
    (r"human-computer", None, ["human-computer-interaction"]),
    (r"natural language", None, ["natural-language-processing", "artificial-intelligence"]),
    (r"robotic|autonomous", None, ["robotics-autonomous-systems", "artificial-intelligence"]),
    (r"automotive software", None, ["software-engineering", "embedded-systems"]),
    (r"software", None, ["software-engineering"]),
    (r"systems engineering", None, ["embedded-systems", "general-computer-science"]),
    (r"machine learning", None, ["machine-learning", "artificial-intelligence"]),
    (r"artificial intelligence|\bai\b", None, ["artificial-intelligence", "machine-learning"]),
    (r"data|analytics", None, ["data-science"]),
    (r"computer science|computer sciences|informatics", None, ["general-computer-science"]),
]


def slugify(text):
    text = unicodedata.normalize("NFKD", text.replace("ß", "ss")).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def university_type(name):
    if re.search(r"applied sciences|hochschule|institute of technology|technische hochschule", name, re.I):
        return "university_applied_sciences"
    if re.search(r"^TU |technical university|technology|technische", name, re.I):
        return "technical_university"
    return "university"


def classify(course):
    field, specs = "computer-science", []
    for pattern, override, slugs in SPEC_RULES:
        if re.search(pattern, course, re.I):
            field = override or field
            specs += [s for s in slugs if s not in specs]
    return field, specs or ["general-computer-science"]


def tri(value, yes, no):
    v = (value or "").strip().lower()
    return "true" if v == yes else "false" if v == no else ""


def ielts(value):
    m = re.match(r"^\s*(\d(?:\.\d)?)", value or "")
    if m:
        return m.group(1), ""
    m = re.search(r"\((\d(?:\.\d)?)\)", value or "")
    if m:
        return m.group(1), value
    return "", value or ""


def academic_year(season, end):
    if season == "winter":
        year = int(end[:4]) + (1 if end and int(end[5:7]) > 9 else 0) if end else 2027
        return f"{year}/{str(year + 1)[2:]}"
    year = int(end[:4]) + (1 if end and int(end[5:7]) >= 7 else 0) if end else 2027
    return str(year)


def qs_sort(value):
    m = re.match(r"\d+", value or "")
    return m.group(0) if m else ""


def main():
    ref = json.load(open(sys.argv[1], encoding="utf-8"))
    locations = ref["UNIVERSITY_LOCATIONS"]
    programs = ref["TRACKER_SEED_DATA"]["programs"]

    qs_by_uni = {}
    for p in programs:
        if p["qsRanking"] not in ("-", ""):
            qs_by_uni.setdefault(p["universityName"], p["qsRanking"])

    uni_slug = {name: slugify(name) for name in locations}
    with open(SEED / "universities.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["slug", "name", "type", "city", "state", "lat", "lng", "qs_ranking", "qs_ranking_sort"])
        for name, loc in sorted(locations.items()):
            qs = qs_by_uni.get(name, "")
            w.writerow([uni_slug[name], name, university_type(name), loc["city"], CITY_STATE[loc["city"]],
                        loc["lat"], loc["lng"], qs, qs_sort(qs)])

    used_slugs = set()
    with open(SEED / "programs.csv", "w", newline="", encoding="utf-8") as pf, \
         open(SEED / "intakes.csv", "w", newline="", encoding="utf-8") as inf:
        pw, iw = csv.writer(pf), csv.writer(inf)
        pw.writerow(["slug", "university_slug", "field_slug", "specialization_slugs", "name", "degree_type",
                     "teaching_language", "official_url", "application_url", "application_portal",
                     "tuition_fee_eur", "application_fee_eur", "ielts_min", "english_note", "moi_accepted",
                     "vpd_required", "nc_restricted", "entrance_exam_interview", "state", "last_verified_at",
                     "source_url"])
        iw.writerow(["program_slug", "season", "academic_year", "application_start", "application_end"])
        for p in programs:
            course = p["courseName"]
            degree = "MEng" if course.startswith("M.Eng") else "MSc"
            title = re.sub(r"^M\.(Sc|Eng)\.\s*", "", course)
            slug = slugify(f"{uni_slug[p['universityName']]} {title} {degree}")
            while slug in used_slugs:
                slug += "-2"
            used_slugs.add(slug)
            field, specs = classify(course)
            ielts_min, english_note = ielts(p["ielts"])
            portal = {"Uni-Assist": "uni_assist", "University Portal": "direct"}.get(p["applicationPortal"], "other")
            fee = p["applicationFee"]
            pw.writerow([
                slug, uni_slug[p["universityName"]], field, "|".join(specs), course,
                degree, "english",
                p["applicationLink"], p["applicationLink"], portal,
                p["tuitionFee"], "" if fee is None else fee, ielts_min, english_note,
                tri(p["moiAccepted"], "yes", "no"), tri(p["vpdRequired"], "yes", None),
                tri(p["restricted"], "nc", "no-nc"),
                "" if p["entranceExamInterview"] in ("-", "") else p["entranceExamInterview"],
                "published", "", p["applicationLink"],
            ])
            season = "winter" if p["intake"] == "Winter" else "summer"
            start, end = p["applicationStartDate"], p["applicationEndDate"]
            iw.writerow([slug, season, academic_year(season, end), start or "", end or ""])
    print(f"{len(locations)} universities, {len(programs)} programs written to {SEED}")


if __name__ == "__main__":
    main()
