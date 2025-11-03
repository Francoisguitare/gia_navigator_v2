
import React, { useMemo } from 'react';
import { NOTES_SHARP, NOTES_FLAT, TUNING, NUM_FRETS } from '../constants';
import { NotePosition } from '../types';

interface HighlightedNote {
  note: string;
  color: string;
  isBlinking: boolean;
  label?: string;
}

interface GuitarNeckProps {
  highlightedNotes: HighlightedNote[];
  scaleNotes?: string[];
}

const calculateNotePositions = (): NotePosition[] => {
  const positions: NotePosition[] = [];
  const noteIndexMap: { [key: string]: number } = {};
  NOTES_SHARP.forEach((n, i) => (noteIndexMap[n] = i));
  NOTES_FLAT.forEach((n, i) => (noteIndexMap[n] = i));

  for (let stringIndex = 0; stringIndex < 6; stringIndex++) {
    const openStringNote = TUNING[5 - stringIndex];
    let currentNoteIndex = noteIndexMap[openStringNote];
    for (let fret = 0; fret <= NUM_FRETS; fret++) {
      const noteName = NOTES_SHARP[currentNoteIndex % 12];
      positions.push({ note: noteName, string: stringIndex, fret });

      const noteNameFlat = NOTES_FLAT[currentNoteIndex % 12];
      if (noteName !== noteNameFlat) {
        positions.push({ note: noteNameFlat, string: stringIndex, fret });
      }
      currentNoteIndex++;
    }
  }
  return positions;
};

const notePositions = calculateNotePositions();

const GuitarNeck: React.FC<GuitarNeckProps> = ({ highlightedNotes, scaleNotes = [] }) => {
  const neckRef = React.useRef<SVGSVGElement>(null);

  const neckDimensions = {
    height: 140,
    nutWidth: 40,
    getNeckWidth: () => (neckRef.current?.clientWidth ?? 800) - 40,
  };

  const getNoteCoordinates = (string: number, fret: number) => {
    const y = (neckDimensions.height / 12) * (string * 2 + 1);
    const x =
      fret === 0
        ? neckDimensions.nutWidth / 2
        : neckDimensions.nutWidth + ((fret - 0.5) * (neckDimensions.getNeckWidth() / NUM_FRETS));
    return { x, y };
  };

  const scaleNoteElements = useMemo(() => {
    return scaleNotes.flatMap(note =>
      notePositions
        .filter(p => p.note === note && p.fret > 0)
        .map(p => {
          const { x, y } = getNoteCoordinates(p.string, p.fret);
          return <circle key={`${note}-${p.string}-${p.fret}`} cx={x} cy={y} r={10} fill="none" stroke="#4b5563" strokeWidth="1.5" opacity="0.4" />;
        })
    );
  }, [scaleNotes]);

  const highlightedNoteElements = useMemo(() => {
    return highlightedNotes.flatMap(hNote =>
      notePositions
        .filter(p => p.note === hNote.note && p.fret > 0)
        .map(p => {
          const { x, y } = getNoteCoordinates(p.string, p.fret);
          return (
            <g key={`${hNote.note}-${p.string}-${p.fret}`}>
              <circle
                cx={x}
                cy={y}
                r={10}
                fill={hNote.color}
                stroke="#030712"
                strokeWidth={2}
                className={`transition-all duration-200 ${hNote.isBlinking ? 'note-dot-blinking' : ''}`}
              />
              <text x={x} y={y} dy="0.35em" textAnchor="middle" fontSize="10" fontWeight="bold" fill="#030712" className="pointer-events-none">
                {hNote.label ?? hNote.note}
              </text>
            </g>
          );
        })
    );
  }, [highlightedNotes]);


  return (
    <div className="w-full overflow-x-auto bg-gray-900 p-2 rounded-lg">
      <svg ref={neckRef} width="100%" height={neckDimensions.height + 20} className="min-w-[800px]">
        <rect x="0" y="0" width="100%" height={neckDimensions.height} fill="#1f2937" rx="8" />
        
        <g id="scale-notes">{scaleNoteElements}</g>

        {/* Frets and Strings */}
        {Array.from({ length: 6 }).map((_, i) => (
          <line
            key={`string-${i}`}
            x1={neckDimensions.nutWidth}
            y1={(neckDimensions.height / 12) * (i * 2 + 1)}
            x2="100%"
            y2={(neckDimensions.height / 12) * (i * 2 + 1)}
            stroke="#4b5563"
            strokeWidth={1 + (i * 0.2)}
          />
        ))}
        {Array.from({ length: NUM_FRETS + 1 }).map((_, i) => (
          <line
            key={`fret-${i}`}
            x1={neckDimensions.nutWidth + (i * (neckDimensions.getNeckWidth() / NUM_FRETS))}
            y1={(neckDimensions.height / 12)}
            x2={neckDimensions.nutWidth + (i * (neckDimensions.getNeckWidth() / NUM_FRETS))}
            y2={(neckDimensions.height / 12) * 11}
            stroke={i === 0 ? '#d1d5db' : '#6b7280'}
            strokeWidth={i === 0 ? 5 : 2}
          />
        ))}
        
        {/* Fret Markers */}
        {[3, 5, 7, 9, 15, 17].map(fret => (
            <circle key={`marker-${fret}`} cx={neckDimensions.nutWidth + ((fret - 0.5) * (neckDimensions.getNeckWidth() / NUM_FRETS))} cy={neckDimensions.height / 2} r={5} fill="#4b5563" />
        ))}
        <circle cx={neckDimensions.nutWidth + ((12 - 0.5) * (neckDimensions.getNeckWidth() / NUM_FRETS))} cy={neckDimensions.height / 3} r={5} fill="#4b5563" />
        <circle cx={neckDimensions.nutWidth + ((12 - 0.5) * (neckDimensions.getNeckWidth() / NUM_FRETS))} cy={2 * neckDimensions.height / 3} r={5} fill="#4b5563" />
        
        {/* Fret Numbers */}
        {[3, 5, 7, 9, 12, 15, 17].map(fret => (
            <text key={`fret-num-${fret}`} x={neckDimensions.nutWidth + ((fret - 0.5) * (neckDimensions.getNeckWidth() / NUM_FRETS))} y={neckDimensions.height + 15} textAnchor="middle" fontSize="10" fill="#9ca3af">{fret}</text>
        ))}

        <g id="highlighted-notes">{highlightedNoteElements}</g>
      </svg>
    </div>
  );
};

export default GuitarNeck;
