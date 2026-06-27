# Fraunces — Authority One display / headline font

The Authority One brand theme renders headlines, the profile display name, and
screen/section titles in **Fraunces** (a serif), matching the marketing site
https://authority-one.com. Body / UI text stays **Inter**.

## ⚠️ Action required: drop the font file in here

The font file is **NOT** committed (it could not be downloaded in the build
sandbox — npm registry, GitHub, and the Google Fonts CDN were all blocked). The
wiring is in place and is **build-safe without it**: `app.config.js` only
registers the file if it exists, so a build won't fail if it's missing — the
headlines just fall back to the system/serif font until you add it.

To get the real Fraunces face on the phone:

1. Download Fraunces (SIL Open Font License) from
   **https://fonts.google.com/specimen/Fraunces** → "Get font" / "Download all".
2. Unzip. In the unzipped folder, take the **variable** file:
   `Fraunces[SOFT,WONK,opsz,wght].ttf`, rename it to `Fraunces.ttf`, and place it
   at `assets/fonts/fraunces/Fraunces.ttf`.
3. **Generate a STATIC instance** (see the next section — this is the important
   step). The variable file alone silently falls back to the system sans.
4. Run a native build (`expo prebuild -p ios` → pod-install → archive/install).
   The `expo-font` plugin registers `Fraunces-Static.ttf` automatically.

## ⚠️ Why a static instance is required (the silent-fallback bug)

`Fraunces.ttf` from Google Fonts is a **variable font** — axes `opsz`, `wght`,
`SOFT`, `WONK`, with a default instance of **"Fraunces 9pt Black"** (opsz=9,
wght=900). React Native / iOS do **not** reliably register variable `.ttf`s:
they either fail to register or load only the default instance, so headlines
render in the system sans. That is exactly the bug seen on real builds.

The fix is to ship a **static cut** generated with `fonttools` and register that
instead. Regenerate it like so (requires `pip install fonttools`):

```sh
cd assets/fonts/fraunces
fonttools varLib.instancer Fraunces.ttf wght=600 opsz=72 SOFT=0 WONK=0 -o Fraunces-Static.ttf
# Then normalize the name table so iOS registers it as family "Fraunces":
python3 - <<'PY'
from fontTools.ttLib import TTFont
f=TTFont("Fraunces-Static.ttf"); n=f["name"]
def s(i,v): n.setName(v,i,3,1,0x409); n.setName(v,i,1,0,0)
s(1,"Fraunces"); s(2,"Regular"); s(4,"Fraunces"); s(6,"Fraunces-Regular"); s(16,"Fraunces"); s(17,"Regular")
n.removeNames(nameID=25)
f.save("Fraunces-Static.ttf")
PY
```

`app.config.js` registers `Fraunces-Static.ttf` (preferred) and only falls back
to the variable `Fraunces.ttf` if the static cut is absent. Chosen display cut:
**SemiBold (wght 600), display optical size (opsz 72)** — suits big headlines.
Adjust `wght`/`opsz` and regenerate if you want a different headline weight.

## Family-name note (if the headline shows the wrong/no face on iOS)

The app references the family string **`Fraunces`** (see
`src/alf/fonts-authority-one.ts`, constant `AUTHORITY_ONE_HEADING_FONT`). This
string MUST equal the static file's internal name-table **family** name — the
guard test `src/alf/fonts-authority-one.test.ts` enforces this and also fails if
a variable font (one with an `fvar` table) is ever registered again. If you
change the font, verify the family name (Font Book, or
`python3 -c "from fontTools.ttLib import TTFont;print(TTFont('Fraunces-Static.ttf')['name'].getDebugName(1))"`)
and update the constant to match, plus the `ios`/`android` values in
`src/lib/themes-authority-one.ts`.

License: Fraunces is SIL OFL 1.1 — free to bundle and redistribute in the app.
