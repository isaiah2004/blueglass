# PROVENANCE — Wikidata ruler reigns (Roman emperors)

**Badge:** History (`temporal_data.roman_emperor`) · **Verdict:** USE

| | |
|---|---|
| Source | Wikidata Query Service, `https://query.wikidata.org/sparql` |
| Retrieval date | 2026-08-28 |
| Licence | **CC0 1.0** — Wikidata's structured data is dedicated to the public domain |
| Transformations | **None.** Raw SPARQL JSON responses stored exactly as returned. |

## Licence

Wikidata publishes all its structured data under the **Creative Commons CC0 1.0 Universal
Public Domain Dedication** (https://www.wikidata.org/wiki/Wikidata:Licensing). No
attribution obligation, no share-alike exposure. *This was not separately fetched and
quoted this run* — it is Wikidata's site-wide, long-standing policy rather than a
per-dataset licence file. Flagging that explicitly rather than implying a file was read.

## What was retrieved

### `roman-emperors.json` — all holders of "Roman emperor" (`wd:Q842606`)

**108 rows.** Query as issued:

```sparql
SELECT ?ruler ?rulerLabel ?startTime ?endTime WHERE {
  ?ruler p:P39 ?st .
  ?st ps:P39 wd:Q842606 .
  OPTIONAL { ?st pq:P580 ?startTime. }
  OPTIONAL { ?st pq:P582 ?endTime. }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
ORDER BY ?startTime
```

**Caveat, verified:** many of the 108 carry **no reign dates** — the unfiltered result is
led by usurpers and short-lived claimants (Sebastianus, Sabinus Iulianus, Domitius
Domitianus, Sponsianus, …) with empty `startTime`/`endTime`. A date-range join must
filter on date presence, not assume it.

### `nt-era-rulers.json` — the usable table

**15 rows**, filtered to `-70 < YEAR(startTime) < 150` with `P580` (start time) required.
This is the complete, dated emperor list spanning the entire New Testament period:

| Emperor | Reign start | Reign end |
|---|---|---|
| Augustus | 26 BC | AD 14-08-17 |
| Tiberius | AD 14-09-16 | AD 37-03-14 |
| Caligula | AD 37-03-16 | AD 41-01-22 |
| Claudius | AD 41-01-23 | AD 54-10-11 |
| Nero | AD 54-10-11 | AD 68-06-07 |
| Galba | AD 68-06-06 | AD 69-01-13 |
| Otho | AD 69-01-13 | AD 69-04-14 |
| Vitellius | AD 69-04-15 | AD 69-12-18 |
| Vespasian | AD 69-12-19 | AD 79-06-22 |
| Titus | AD 79-06-22 | AD 81-09-11 |
| Domitian | AD 81-09-12 | AD 96-09-16 |
| Nerva | AD 96-01-01 | AD 98-01-25 |
| Trajan | AD 98-01-26 | AD 117-08-06 |
| Hadrian | AD 117-08-10 | AD 138-07-09 |
| Antoninus Pius | AD 138-07-09 | AD 161-03-06 |

Dates are **day-precision**, which is far better than the badge needs.

## Correction to the roadmap

`ROADMAP.md` §4 and `data-inventory.md` §6 describe `roman_emperor` as
"a ~200-row **hand table** (Wikidata-derivable)" costing **S** effort. It is not a hand
table — it is **one SPARQL query returning 15 rows** with day-precision dates. Joined by
date range against `Theographic Events.csv` `startDate`, `temporal_data.roman_emperor`
is fully deterministic. Effort is closer to an afternoon than to days.

## What is NOT covered — stated explicitly

The badge may also want the **Herodian rulers** (Herod the Great, Antipas, Agrippa I/II)
and the **Roman prefects/procurators of Judaea** (Pilate, Felix, Festus) and provincial
proconsuls (Gallio, Acts 18:12) — all of whom appear by name in the NT.

**These were not successfully retrieved this run.** An attempted query using guessed
Wikidata Q-ids returned unrelated entities (Mercedes Sosa, Earl Warren), proving only that
the ids were wrong. Wikidata almost certainly holds these people and their terms of
office, but **the coverage is unverified** and needs a properly entity-resolved query
before anyone plans on it.

## Files

| File | Bytes | SHA-256 |
|---|---:|---|
| `nt-era-rulers.json` | 12,063 | `c375a72ba1af8c78a940aead8fbfacfa12ab72a1658790711e50a53dc66cf08f` |
| `roman-emperors.json` | 52,292 | `31619373769e21db0bf2e6441cf32c6504d4ce999a2b9dd4e84561f3c56ed584` |

**Total:** 2 files, 64,355 bytes.
