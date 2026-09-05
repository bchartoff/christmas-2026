// Notes are drawn from D major, the key of Pachelbel's Canon, and each letter is
// placed so that every name in NAMES spells one of the Canon's own chords
// (D, A, Bm, F#m, G, Em) -- with no semitone or minor-9th clash in the voicing.
const LETTER_NOTES = [
  { letter: "H", note: "A2", midi: 45 },
  { letter: "C", note: "B2", midi: 47 },
  { letter: "P", note: "C#3", midi: 49 },
  { letter: "T", note: "D3", midi: 50 },
  { letter: "B", note: "E3", midi: 52 },
  { letter: "R", note: "G3", midi: 55 },
  { letter: "U", note: "A3", midi: 57 },
  { letter: "A", note: "B3", midi: 59 },
  { letter: "E", note: "D4", midi: 62 },
  { letter: "S", note: "E4", midi: 64 },
  { letter: "M", note: "F#4", midi: 66 },
  { letter: "L", note: "G4", midi: 67 },
  { letter: "N", note: "A4", midi: 69 },
  { letter: "I", note: "B4", midi: 71 },
  { letter: "J", note: "C#5", midi: 73 },
  { letter: "V", note: "D5", midi: 74 },
  { letter: "O", note: "E5", midi: 76 },
  { letter: "Y", note: "F#5", midi: 78 },
];

const NAMES = [
  "BEN", "NATALIE", "CALEB", "JONAH", "HAILEY", "PAUL", "SIMON", "OLLIVER",
  "CARMEN", "SUE", "JIM", "JANET", "REBECCA", "JASON", "SAM", "CALVIN",
];

const NOTE_BY_LETTER = new Map(LETTER_NOTES.map((d) => [d.letter, d]));
