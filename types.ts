
export interface TargetNote {
  note: string;
  interval: string;
  intention: string;
  description: string;
  type: 'fondatrice' | 'expressive';
}

export interface ChordAnalysis {
  accord: string;
  degre: string;
  front: 'TENSION' | 'RÉSOLUTION' | 'HORS TONALITÉ';
  actionRythmique: 'RAPIDE / AGRESSIF' | 'LENT / LYRIQUE';
  // FIX: Add notes array to store the notes of the chord for playback.
  notes: string[];
  allTargetOptions: TargetNote[];
}

export interface FullAnalysis {
  tonalite: string;
  notesGamme: string[];
  progressionAnalysis: ChordAnalysis[];
}

export interface NotePosition {
  note: string;
  string: number;
  fret: number;
}

export interface GamificationData {
  xp: number;
  level: number;
  timePlayed: number; // in seconds
}

export enum PlayerState {
  Stopped,
  CountingDown,
  Playing,
}