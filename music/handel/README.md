# Mix Up the Measures – Handel, Piano 1 (with suggested fingering)

- `line1.png` … `line8.png`: the 8 lines (systems) of the sheet music, rendered from the PDF
  Lindsay provided (both staves, fingering and her handwritten markings in measures 1–2 kept;
  page title, page number and printed measure numbers masked). The app crops these at the
  barlines using the measure bounds stored in `PIECE` in `index.html`.
- `handel-piano1.musicxml` / `.mid`: the checked transcription the parent-only Play button uses
  (34 measures, 4/4, no key signature, ♩ = 100; 8va from measure 19 to the end; measures 1–2 left
  hand include the handwritten A3–C4 eighths).
- Check me: `PIECE.notes[n].rhp/lhp` in `index.html` hold the position of every notehead (fractions
  of its line image), so the app can ring each note green or orange. The mic listener is
  `checkme-worklet.js` (also embedded in `index.html`, so it works offline): a single-note pitch
  detector (YIN) plus a strike detector that compares the sound just before and after each key
  press. It follows the notes of the current chunk in order (both hands as one sequence, ties
  not re-played); there is no timing requirement. Nothing is recorded or sent anywhere; in
  "Both" mode only the per-note marks go to the paired phone.
- Music: G. F. Handel. Simplification: Nguyen Hoang Minh. For Maddy's personal practice.

Piano sound: `../../piano/*.mp3` are Salamander Grand Piano samples by Alexander Holm
(CC BY 3.0), in the MP3 versions published with Tone.js (tonejs.github.io/audio/salamander).
