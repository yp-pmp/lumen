# LUMEN

A quiet digital journal. Warm ivory, one dusty-blue accent, a serif that is
comfortable to read for a long time, and as little interface as the job allows.

Everything you write stays in your own browser. There is no account, no server
to talk to, and no network request of any kind once the page has loaded.

## Running it

```bash
./start.sh
```

That serves this folder on <http://localhost:4173> and opens it. Pass a port if
you'd like a different one: `./start.sh 8080`. Stop it with Ctrl-C.

## On your phone

```bash
./start.sh --lan
```

This prints a second address — something like `http://10.0.17.79:4173` — that
any device on the same Wi-Fi can open. Type it into Safari or Chrome on your
phone while this Mac is awake and serving.

Then **Share → Add to Home Screen**. LUMEN has a manifest and an icon, so it
opens full-screen with no browser chrome, which is the way it's meant to be
used on a phone.

Two things to know before you rely on it:

- **The phone keeps its own journal.** Storage is walled off per browser, per
  device and per origin — an iOS home-screen app, Safari and Chrome each get
  their own container, so they each start an empty journal. Settings →
  **Export everything** on one and **Bring in a backup** on the other
  reconciles them (see below).
- **It only works while this Mac is serving and you're on the same network.**
  There's no offline caching, because a service worker needs HTTPS and a plain
  LAN address isn't a secure context. If you want LUMEN on your phone properly
  — away from home, offline, always there — put it on a static host over HTTPS
  (see below). Everything still stays in your browser; the host only serves the
  files.

Loopback is the default and `--lan` is opt-in for a reason: with `--lan`,
anything on your network can load the app. That doesn't expose your journal —
entries never touch the server — but it does serve this folder to the network.

`start.sh` just runs `serve.py`, a twenty-line static server built on Python's
standard library — no install step, no dependencies, nothing to build. Any other
static server works equally well:

```bash
python3 -m http.server 4173
```

Opening `index.html` directly from Finder will *not* work: browsers refuse to
load ES modules over `file://`. It needs to be served over http.

## Deploying it later

It is a folder of static files, so it can be dropped onto Netlify, Vercel,
GitHub Pages, S3, or any web host as-is — no build command, no output
directory, just upload the folder. Over HTTPS you also get the proper phone
experience: install to the home screen from anywhere, not only your own Wi-Fi.

Journal entries still live in each browser's local storage, so each device
keeps its own journal, and the host never sees a word of it.

## Where things are

```
index.html            the shell — everything else is loaded from here
serve.py, start.sh    the local server (--lan opens it to your phone)
manifest.webmanifest  home-screen name, colours and display mode
icon.svg              the home-screen icon
styles/
  tokens.css          every colour, type step, spacing value and timing
  lumen.css           the stylesheet, in the order the app is built
js/
  app.js              mounts views, sets the theme and the time-of-day light
  router.js           hash routing (#/journal, #/entry/:id, …)
  store.js            local-first persistence; the only file that touches storage
  prompts.js          invitations and the eight prompt categories
  views/              today · editor · journal · entry · reflections · onboarding
  components/         calendar · settings sheet
  utils/              dom · date · text (word counts, excerpts, theme finding)
  data/demo.js        fictional demo entries, all flagged isDemo
```

## Privacy

- Entries are written to `localStorage` under `lumen.v1.*` and nowhere else.
- The app makes no `fetch`, no XHR, no WebSocket, and loads no external font,
  script, or image. The page's own files and inline `data:` URIs are all of it.
- Journal text is never written to the console. The two `console.warn` calls in
  `store.js` report that storage failed, never what was in it.
- The "words that kept returning" list on a monthly reflection is counted in
  `js/utils/text.js`, in your browser, over your own text. Nothing is sent out
  to produce it.
- **Export everything** in Settings downloads a JSON file of your entries, and
  **Bring in a backup** reads one back. Both happen in the browser: the file is
  parsed locally and never uploaded. Where the exported file goes afterwards is
  up to you.

## Demo pages

Settings → **Add demo pages** loads fifteen fictional entries, including one
written a year ago today so you can see "On this day". Every one carries
`isDemo: true`, and **Remove demo pages** deletes exactly those and nothing
else. Anything you have written yourself is untouched.

## Moving pages between devices

Settings → **Export everything** writes a JSON file; **Bring in a backup**
reads one back. The merge is safe to run in either direction, as often as you
like:

- Pages are matched by id. One that isn't here yet is added.
- If both sides have a page, **the more recently edited copy wins**, so an edit
  made on your phone reaches your Mac and the other way round.
- Two copies that say the same thing are left alone whatever their timestamps
  claim, so nothing gets a spurious "edited" mark.
- The earlier `createdAt` is kept — an edit elsewhere doesn't rewrite when a
  page was started.
- Month reflection notes follow the same newest-wins rule.

**Deletions don't travel.** Nothing in an import removes anything, so a page
you deleted on one device comes back if you later import an older file from
another that still has it. Doing that properly needs deletion records, which
the format doesn't carry yet.

Two other caveats worth knowing. Newest-wins compares clocks, so if two devices
disagree badly about the time, the wrong copy can win. And if you edit the
*same* page on both devices before reconciling, one of those edits is lost —
this is a merge, not a three-way diff.

## Keeping your writing

Local storage is durable but it is not a backup: clearing site data in your
browser will take the journal with it. If the journal starts to matter, export
it from Settings now and then.

## Data shape

```js
{
  id, createdAt, updatedAt,
  date,            // "2026-08-09" — your local day, so an 11pm page
                   //  belongs to that evening and not to tomorrow
  content,         // plain text
  mood,            // one of eight, or null
  prompt,          // the prompt text, or null
  promptCategory,  // "Gratitude", "Work", … or null
  wordCount,
  isDemo,          // only on demo entries
}
```

Stable ids and `updatedAt` are there so a sync layer could be added later
without reshaping anything.

## Notes on the design

- One column width across every screen, so the left margin never shifts as you
  move between Today, Journal and Reflections.
- The background warms and cools slightly with the hour (dawn / day / dusk /
  night). It is meant to be noticed only if you go looking.
- `prefers-reduced-motion` disables every animation, including the drifting
  background wash. Nothing depends on motion to be legible.
- Dark mode is a different room, not an inverted one: warm near-black, cream
  type, and a recessed accent so the primary button doesn't shout at midnight.
