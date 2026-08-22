/* What has changed, in the writer's language rather than the committer's.

   Bump APP_VERSION whenever you add an entry. It is what tells LUMEN there is
   something new to point at, and it is compared entirely on the device — no
   version is ever fetched from anywhere. */

export const APP_VERSION = "2026.08.22";

export const CHANGELOG = [
  {
    version: "2026.08.22",
    date: "22 August 2026",
    lines: [
      "Milestones: mark a page as a moment worth remembering, and see them all on a timeline in Reflections. Mark one while writing, from the finished page, or straight from the Journal list.",
      "A long entry no longer jumps away from the cursor while you type.",
      "Long words and pasted links now wrap instead of running off the side of the screen.",
      "The \"newer version\" notice sits properly on a phone screen instead of running off the edge.",
      "Updates now appear as soon as they are published, rather than after a delay of up to ten minutes.",
      "Settings now carries a short anonymous feedback form, if you have something to say about the app.",
    ],
  },
  {
    version: "2026.08.10",
    date: "10 August 2026",
    lines: [
      "Photographs: add pictures to a page, kept as polaroids.",
      "LUMEN now opens without a connection once you have used it once.",
      "An occasional, dismissible reminder to save a backup copy.",
      "About this journal, in Settings, explaining where your writing lives.",
      "Text throughout is darker and easier to read in daylight.",
      "Backups now carry edits and deletions between devices, not just new pages.",
    ],
  },
  {
    version: "2026.08.09",
    date: "9 August 2026",
    lines: [
      "The first version: Today, Journal and Reflections, written and kept entirely on your own device.",
    ],
  },
];
