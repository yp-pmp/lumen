# LUMEN

A quiet digital journal. Warm ivory, one dusty-blue accent, a serif that is
comfortable to read for a long time, and as little interface as the job allows.

Everything you write stays in your own browser. There is no account, no server
to talk to, and no network request of any kind once the page has loaded. The one
outbound path is a feedback link in Settings, which opens a form in a new tab if
you choose to click it — nothing is sent from the journal itself.

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
- **Over `--lan` it only works while this Mac is serving and you're on the
  same network.** Offline support needs a service worker, which needs a secure
  context, and a plain LAN address isn't one. For LUMEN on your phone properly
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

## Offline

`sw.js` is a service worker that caches the app's own files, so once you have
opened LUMEN on a device it launches with no connection at all. It registers
itself on load; there is nothing to switch on.

It is **network-first with a 2.5 second timeout**, and its fetches deliberately
bypass the browser's HTTP cache. That second part matters: GitHub Pages serves
everything with `Cache-Control: max-age=600`, and a plain `fetch()` consults
that cache first — which would make "network-first" mean "up to ten minutes
stale", so a freshly deployed change could fail to appear however many times the
page was reloaded. With `cache: "no-store"` the strategy is honest, at the cost
of one small download per launch. The registration also passes
`updateViaCache: "none"` so the check for a newer worker is not itself answered
from a cached copy.

Online you therefore get the current version. Offline —
or on a connection that has gone vague — the request falls back to the cache
almost immediately and the app opens as usual. Writing, searching, reflections
and everything else already ran locally, so nothing is degraded; only the
initial load ever touched the network.

Two things to know. It needs HTTPS (or `localhost`), so it is inactive over
`--lan`. And **if you add a file to the app, add it to `PRECACHE` in `sw.js`**,
or it won't be there offline.

### Noticing a new version

Because the worker is network-first, *launching* the app while online already
loads the current version — there is no stale build to clear. What that cannot
do is change the code of a page already open, which is the case for an app left
running, or installed to a home screen and resumed from the background rather
than launched fresh.

So `js/updates.js` listens for the browser handing control to a newer service
worker and offers a reload — never taking one, and never while you are writing: the notice
waits until you leave the editor, and one already on screen is hidden the moment
the editor opens. It polls no version endpoint: the
signal comes from the browser's own update machinery, and the only thing it asks
for is a re-read of `sw.js` when you return to the app after half an hour away.

### What's changed

`js/data/changelog.js` holds the release notes shown in Settings, newest first.
**Bump `APP_VERSION` whenever you add an entry** — that constant is what marks
the list as new, compared against what this device last saw. Nothing is fetched
to determine it.

## Where things are

```
index.html            the shell — everything else is loaded from here
sw.js                 offline caching of the app's own files
serve.py, start.sh    the local server (--lan opens it to your phone)
manifest.webmanifest  home-screen name, colours and display mode
icon.svg              the home-screen icon
styles/
  tokens.css          every colour, type step, spacing value and timing
  lumen.css           the stylesheet, in the order the app is built
js/
  app.js              mounts views, sets the theme and the time-of-day light
  router.js           hash routing (#/journal, #/entry/:id, …)
  store.js            local-first persistence for text and metadata
  backup.js           saving a copy to the device
  media.js            photographs — resizing, IndexedDB, export encoding
  prompts.js          invitations and the eight prompt categories
  views/              today · editor · journal · entry · reflections · onboarding
  components/         calendar · polaroid · settings sheet · about
  utils/              dom · date · text (word counts, excerpts, theme finding)
  updates.js          noticing when a newer version has taken over
  data/changelog.js   release notes shown in Settings
  data/demo.js        fictional demo entries, all flagged isDemo
```

## Photographs

A page can hold photographs. **Add a photograph** in the editor opens the
picker — on a phone that offers the camera as well as the library.

Each one is resized to fit a 1600px box and re-encoded as JPEG, which takes a
typical phone photo from several megabytes to a few hundred kilobytes. That
matters twice over: pictures have to fit in browser storage, and they have to
travel inside an export. Re-encoding also **strips the EXIF block**, so the GPS
coordinates a phone writes into a photo never reach storage or a backup file.

The polaroid look — the mount, the deep lower margin, the slight tilt — is
presentation only, done in CSS. **The stored picture is the picture you took**,
uncropped and unfiltered, so the styling can change later, or come off
entirely, without having damaged anything.

Pictures live in IndexedDB rather than `localStorage`, which holds about 5MB of
strings and would be filled by a single photo. Entries keep only the ids. A page
can be nothing but a photograph — it will appear in the archive, on Today and in
the calendar like any other.

## Milestones

Any page can be marked as a milestone, from three places: the editor footer
while you are writing, the finished page, or the end of a page's metadata line
in the Journal. All three say **Mark as a milestone** in words — an earlier
version used an unlabelled ring in the archive, which gave no clue what it did
and could not be explained by a tooltip on a phone. Each one asks for a few
words — "Moved to the new flat", "Started the
new job". Reflections then shows a **Milestones** timeline, earliest first and
grouped by year, each line linking back to the page you wrote that day.

In the editor it waits for your first words, exactly as the mood row does, so a
blank page never asks. Elsewhere it is always there: some days announce
themselves while you write, and some only in hindsight, and neither should mean
opening a page you have just closed.

These are *your* milestones, not the app's. LUMEN never awards one, never
counts them, and shows no progress towards anything: no "100 pages written", no
streaks, nothing to complete. A milestone is a caption on a day. The label is
searchable, travels with the page in a backup, and follows the same
newest-wins rule as any other edit.

## About this journal

Settings closes from a × pinned to the top of the sheet, which stays put as the
sheet scrolls — it grew long enough that a button at the very bottom was a hunt.
Escape closes it too.

It carries a short **About this journal** section, collapsed by default,
explaining where writing is stored, how to install it to a home screen, how the
two-device reconciliation works and what its limits are. It is written for
someone arriving at the link cold — worth reading if you are sharing LUMEN with
anyone, since there are no accounts and nothing recovers a journal that a
browser has cleared.

## Privacy

- Entries are written to `localStorage` under `lumen.v1.*`, and photographs to
  an IndexedDB database called `lumen`. Both are local to this browser.
- `lumen.v1.deleted` keeps the ids and timestamps of deleted pages so that
  deletions can travel between devices. It holds no journal text — deleting a
  page still destroys its content immediately and irreversibly.
- The app makes no `fetch`, no XHR, no WebSocket, and loads no external font,
  script, or image. The page's own files and inline `data:` URIs are all of it.
- Settings carries one external **link** — an anonymous feedback form hosted by
  Google. A link is not a request: nothing is contacted unless you click it, and
  it carries `rel="noopener noreferrer"` so the form is not told which page you
  came from. Nothing from the journal is attached.
- The service worker caches only those same files. It has no journal content to
  cache — entries are never fetched over the network — and it sends nothing.
- Journal text is never written to the console. The two `console.warn` calls in
  `store.js` report that storage failed, never what was in it.
- The "words that kept returning" list on a monthly reflection is counted in
  `js/utils/text.js`, in your browser, over your own text. Nothing is sent out
  to produce it.
- Photographs are re-encoded on the way in, which discards EXIF — including
  the GPS coordinates a phone records. Location never enters storage.
- **Export everything** in Settings downloads a JSON file of your entries and
  photographs, and **Bring in a backup** reads one back. Both happen in the browser: the file is
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
like. Pages are matched by id, and **the most recent action wins** — whether
that action was an edit or a deletion:

- A page that isn't here yet is added.
- If both sides have it, the more recently edited copy wins, so an edit made
  on your phone reaches your Mac and the other way round.
- A page you deleted on one device is deleted here too.
- A page you deleted and *then* rewrote stays: the writing is newer than the
  deletion, so it counts as a deliberate revival.
- Two copies that say the same thing are left alone whatever their timestamps
  claim, so nothing gets a spurious "edited" mark.
- The earlier `createdAt` is kept — an edit elsewhere doesn't rewrite when a
  page was started.
- Month reflection notes follow the same newest-wins rule.
- Photographs travel with the pages that reference them, and one already on
  this device is never written twice.

Deletions travel because the export carries a `deleted` map of `id → when`.
Those records hold no content, only that a page with that id was deleted and
at what moment, which is the minimum needed to stop it reappearing. Exports
made before this existed still import fine; they simply carry no deletions.

**Delete everything** is the one exception: it records nothing, because it is a
local reset rather than a page-by-page decision — and tombstoning the lot would
make your own backups impossible to restore. Removing demo pages records
nothing either, so they can be added back.

Two caveats remain. Newest-wins compares clocks, so if two devices disagree
badly about the time, the wrong copy can win. And if you edit the *same* page
on both devices before reconciling, one of those edits is lost — this is a
merge, not a three-way diff.

## Keeping your writing

Local storage is durable but it is not a backup: clearing site data in your
browser will take the journal with it, and nobody can recover it for you,
because nobody else has a copy.

**Recommended rhythm.** Writing most weeks: save a copy monthly. Writing
occasionally: every few months. Always before changing device, clearing browser
data, or removing the app from a home screen.

**The notice.** If there are at least ten pages and either no copy has ever
been saved or the last one was over 90 days and five pages ago, LUMEN shows a
quiet line at the foot of Today offering to save one. "Not now" silences it for
30 days; saving resets it. On those thresholds it appears two or three times a
year. It is the only reminder that exists — there are no notifications and no
emails, because there is no server to send them and adding one would undo the
privacy model.

**Durability.** Once there is something to protect, LUMEN calls
`navigator.storage.persist()` to ask the browser not to evict its storage when
the device runs short of space. Browsers decide for themselves — Chrome
silently, Firefox may prompt, Safari by its own heuristics — and an installed
home-screen app is likelier to be granted it. The request is repeated at most
once a month, since a refusal can become a yes later.

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
  images,          // ids of photographs, kept in IndexedDB
  isDemo,          // only on demo entries
}
```

Deletions are recorded separately, as `{ [id]: deletedAt }`, and travel in the
export under `deleted`.

Stable ids and `updatedAt` are there so a sync layer could be added later
without reshaping anything.

## Notes on the design

- One column width across every screen, so the left margin never shifts as you
  move between Today, Journal and Reflections.
- The background warms and cools slightly with the hour (dawn / day / dusk /
  night). It is meant to be noticed only if you go looking.
- `prefers-reduced-motion` disables every animation, including the drifting
  background wash. Nothing depends on motion to be legible.
- The editor's textarea grows without ever collapsing to `height: auto` first.
  Collapsing shrinks the document for one layout pass, which makes the browser
  clamp the scroll position and throws a long page away from the caret on every
  keystroke. It only re-measures from scratch when the text got shorter, and
  smooth scrolling is switched off while writing so no correction animates.
- Nothing scrolls sideways. Rows of words are wrapping flex containers rather
  than inline runs, and every surface that shows your own text sets
  `overflow-wrap: anywhere` with `min-width: 0` where it is a flex item — so a
  pasted URL or a very long word breaks instead of pushing the column open.
- Every piece of text meets WCAG AA contrast (4.5:1) in both themes. The ink
  ramp stops at `--ink-faint`; `--ink-ghost` is lighter than that threshold and
  is reserved for decoration — separators, meta dots, progress dots —
  so putting text in it would reintroduce the problem.
- Dark mode is a different room, not an inverted one: warm near-black, cream
  type, and a recessed accent so the primary button doesn't shout at midnight.
