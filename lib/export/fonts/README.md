# PDF export fonts

These TrueType fonts are loaded by the server-side PDF route at
`app/api/export/cover-letter-pdf/route.ts` to render Latin, Cyrillic,
and Armenian glyphs correctly.

## Files

- `NotoSans-Regular.ttf` / `NotoSans-Bold.ttf`
  - Covers Latin, Latin Extended, Cyrillic, Greek, common punctuation.
  - Source: <https://github.com/notofonts/latin-greek-cyrillic>
- `NotoSansArmenian-Regular.ttf` / `NotoSansArmenian-Bold.ttf`
  - Covers the Armenian Unicode block.
  - Source: <https://github.com/notofonts/armenian>

## Why two families

`NotoSans-Regular.ttf` does NOT include Armenian glyphs; `NotoSansArmenian`
covers Armenian but only a tiny Latin punctuation set. The PDF route
splits each text run by Unicode block and switches font per segment so
mixed Russian/English/Armenian content (company names, product names,
URLs) renders correctly without missing-glyph boxes.

## Why under `lib/export/fonts/` and not `public/`

These are read at request time on the server with `fs.readFileSync` —
they need to be in the source tree, not the static asset folder. Putting
them under `public/` would also expose them as downloadable URLs, which
isn't useful here.

## Updating fonts

Re-download from the sources above and overwrite the files in this
directory. No code change required as long as the file names stay the
same.

## License

Both font families are licensed under the SIL Open Font License v1.1.
See the upstream repos for the full license text.
