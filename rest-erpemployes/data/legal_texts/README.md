# Legal texts

Files loaded with `python manage.py load_legal_texts <file.json>`
(format: `python manage.py help load_legal_texts`). One entry per article.

| File | Text | Source |
|---|---|---|
| `cm-code-travail-1992.json` | Cameroon Labour Code, Law No. 92/007 of 14 August 1992, articles 1 to 177 | Droit-Afrique copy hosted by FAO (FAOLEX): https://faolex.fao.org/docs/pdf/cmr198304.pdf, also hosted by the ILO |

## How it was produced

Text extracted from the PDF, split on `Art.N.-`. Only layout was changed:
page headers removed, words cut at line ends rejoined, lines joined. Each
article keeps its title / chapter / section as `title`.

## Known limits

- **This is the original 1992 text.** Later amendments are not included;
  check them before relying on an article in production.
- The PDF text layer contains a few spaces inside words (e.g. "indi
  sponibilité", "artic le"); they come from the source and were left as is.
- The source has a typo at article 78 ("Art.- 78.-"), handled by the split.
