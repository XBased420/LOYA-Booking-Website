# Elizabeth Loya — personal site

Audio engineer, DJ, radio producer. Dallas.

---

## Just want to look at it

Double-click **START.bat**. A browser opens at `http://localhost:8767`.
Leave the black window open while you browse; closing it stops the site.

Runs on port 8767 so it does not fight with the Schedule App on 8766 —
both can run at once.

## Changed something and want to see it

1. Edit files under **site\**
2. Double-click **REFRESHBUILD.bat**
3. Double-click **START.bat**

`dist\` is *generated*. Editing it directly works right up until the next
build overwrites it without warning — so always edit `site\` and rebuild.

---

## What is in here

```
LoyaPersonalWebsite\
├── START.bat          double-click to view the site
├── REFRESHBUILD.bat   rebuild dist\ after editing site\
├── serve.py           the local server (START.bat runs it)
├── dist\              the built site — what START.bat serves
├── site\              Astro source — THIS is what you edit
│   ├── src\pages\     one file per page
│   ├── src\components\  Paper, Tape, Polaroid, Photo, Slot, AudioTrack…
│   ├── src\data\      all content and facts live here
│   └── public\media\  images and video used by the site
├── motion\            Remotion project that renders the hero reel
└── tools\             the scripts that converted the original media
```

### Where the content lives

Almost nothing is hard-coded into a page. To change what the site says,
edit these:

| File | Holds |
|---|---|
| `site\src\data\site.ts` | Name, roles, intro line, education, career, tools, contact, the list of outstanding gaps |
| `site\src\data\work.ts` | Services, studio kit, projects, audio tracks, archive categories and imagery |
| `site\src\data\booking.ts` | Bookable services, the booking record shape, the endpoint |

---

## Filling in the missing pieces

The site shows a labelled slot wherever content has not been supplied —
`[ADD STUDIO PRICING]`, `[UPLOAD AUDIO SAMPLES]`, and so on. That is
deliberate: nothing is invented to make a page look finished.

The full outstanding list is `pending` at the bottom of
`site\src\data\site.ts`. **18 items.** To close one, replace its
`TBD("...")` with the real value, or add records to the empty arrays in
`work.ts`, then run REFRESHBUILD.bat.

The single highest-value item is **audio samples**. Every page that says
"listen" currently says "not supplied yet", and on an audio engineer's
site that is the one absence a visitor notices.

### Turning the booking form on

`site\src\data\booking.ts` → set `bookingEndpoint` to a real URL. Until
then "Send request" stays disabled with a note saying why, and "Review
request" shows exactly what would be sent. The form deliberately does not
pretend to submit into nowhere.

---

## Not in this folder

The original media vault stays at **`C:\Users\calip\loya-site\media\`** —
about 1.7 GB of untouched originals (`_source\`), full-resolution masters
(`work\`) and the complete derivative library (`web\`). It is not here
because this folder is inside OneDrive and syncing 1.7 GB of source photos
would be a waste of the quota. The site only needs the ~98 MB already
staged in `site\public\media\`.

`node_modules\` is also absent for the same reason (~160 MB, regenerable).
REFRESHBUILD.bat installs it on first run.

---

## Status

All 11 pages built, 18 routes, production build clean.
Not deployed anywhere — this runs locally only.

Elizabeth has not reviewed the site yet.
