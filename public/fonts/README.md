# Fonts

Sofia Sans and Sofia Sans Semi Condensed are self-hosted under the SIL Open
Font License 1.1 in `sofia-sans/LICENSE.txt`. The Latin and Latin Extended
variable WOFF2 subsets (weights 100–900) come from Fontsource's variable
distributions (upstream source at https://github.com/lettersoup/Sofia-Sans).

`public/rer-theme.css` declares the faces once, so every page that links the
theme (the app, sign-in, /setup, the Lobby, the run site) has them, and no page
makes a third-party request. Semi Condensed is the heading face
(`--rer-font-heading`); Sofia Sans is the body, label, button and figure face
(`--rer-font-body`). `src/base/font-head.ts` preloads the two Latin files.
