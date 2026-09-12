# Deploying a font beside the app (optional)

The app carries Roboto and Inter. Any **other** family can be served by this
deployment, without touching the build: create a folder named exactly like the
family and drop its woff2 files in it.

```
fonts/<family>/<family>-Regular.woff2   weight 400
fonts/<family>/<family>-Medium.woff2    weights 500–600
fonts/<family>/<family>-Bold.woff2      weights 700–800
```

For a family named `Atelier Sans`, that is
`fonts/Atelier Sans/Atelier Sans-Regular.woff2`.

Set the same name in the editor (Settings → Appearance → Font). The card
probes the live document and tells you whether the faces actually arrived
(`served`) or not (`missing`, and the text renders on the system stack). The
files are requested from this deployment only — never from a third party.

**No font is redistributed here.** Deploying a font is redistribution: check
that its license allows it. The alternative, which travels with the file, is
to embed the woff2 in the portfolio itself (same screen, "Embed .woff2
files…") — the same licensing question applies, and the editor says so.
