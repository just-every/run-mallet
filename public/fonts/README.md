# Fonts

Inter, Inter Tight and JetBrains Mono are self-hosted under the SIL Open Font
License 1.1 (each folder's `LICENSE.txt`). The Latin and Latin Extended
variable WOFF2 subsets come from Fontsource's variable distributions.

`public/site/tokens.css` declares the faces once with the brand's tokens, so
every page that links it (the run site, the app, and Base's sign-in, /setup and
Lobby through `public/brand/frame.css` and the edition identity's `fonts` link)
has them, and no page makes a third-party request. Inter Tight is the display
face (`--font-display`, `--rer-font-heading`); Inter is the body, label, button
and figure face (`--font-body`, `--rer-font-body`). `src/base/font-head.ts`
preloads the two Latin files.
