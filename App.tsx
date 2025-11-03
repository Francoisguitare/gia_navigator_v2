
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { MonoSynth, PolySynth, Synth, MembraneSynth, Part, Transport, Draw, context, start } from 'tone';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from './services/firebase';

import { FullAnalysis, ChordAnalysis, TargetNote, GamificationData, PlayerState } from './types';
import { TOTAL_CELLS, GAMIFICATION_XP_PER_LEVEL, GAMIFICATION_XP_PER_SECOND, PRESET_PROGRESSIONS } from './constants';
import { analyzeProgressionWithGemini } from './services/geminiService';
import GuitarNeck from './components/GuitarNeck';
import AuthModal from './components/AuthModal';
import { PlayIcon, StopIcon, LoadingSpinner, TrophyIcon, ClockIcon, UserIcon } from './components/icons';

const CircleProgress: React.FC<{ progress: number; size: number; strokeWidth: number; level: number }> = ({ progress, size, strokeWidth, level }) => {
    const center = size / 2;
    const radius = center - strokeWidth / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (progress / 100) * circumference;

    return (
        <div className="relative" style={{ width: size, height: size }}>
            <svg width={size} height={size} className="-rotate-90">
                <circle stroke="#374151" fill="transparent" strokeWidth={strokeWidth} r={radius} cx={center} cy={center} />
                <circle
                    stroke="#facc15"
                    fill="transparent"
                    strokeWidth={strokeWidth}
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    r={radius}
                    cx={center}
                    cy={center}
                    strokeLinecap="round"
                    className="transition-all duration-300 ease-linear"
                />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xs font-semibold text-yellow-500">LVL</span>
                <span className="text-xl font-bold text-white">{level}</span>
            </div>
        </div>
    );
};

const GamificationDashboard: React.FC<{ data: GamificationData }> = ({ data }) => {
    const levelProgress = (data.xp / GAMIFICATION_XP_PER_LEVEL) * 100;
    return (
        <div className="fixed bottom-0 left-0 right-0 bg-gray-950/80 backdrop-blur-sm border-t border-gray-800 p-3 z-30">
            <div className="w-full max-w-7xl mx-auto flex items-center justify-between gap-4 text-sm sm:justify-around">
                <div className="flex items-center gap-4">
                     <CircleProgress progress={levelProgress} size={50} strokeWidth={5} level={data.level} />
                     <div className="flex flex-col">
                        <span className="font-bold text-lg text-white">Niveau {data.level}</span>
                        <span className="text-xs text-gray-400">{data.xp} / {GAMIFICATION_XP_PER_LEVEL} XP</span>
                     </div>
                </div>
                <div className="flex flex-col items-center gap-1 text-cyan-400">
                     <ClockIcon className="w-6 h-6"/>
                     <span className="font-semibold text-sm">{Math.floor(data.timePlayed / 60)}m {data.timePlayed % 60}s</span>
                     <span className="text-xs text-gray-400">Temps de jeu</span>
                </div>
            </div>
        </div>
    );
};


const AnalysisCard: React.FC<{ 
    analysis: ChordAnalysis; 
    analysisIndex: number; 
    onSelectNote: (note: TargetNote) => void;
    selectedNote?: TargetNote;
}> = ({ analysis, analysisIndex, onSelectNote, selectedNote }) => {
    
    const frontStyles = {
        'RÉSOLUTION': 'border-blue-500/50 bg-blue-500/10',
        'TENSION': 'border-red-500/50 bg-red-500/10',
        'HORS TONALITÉ': 'border-yellow-500/50 bg-yellow-500/10'
    };
    
    const badgeStyles = {
        'RÉSOLUTION': 'bg-blue-500 text-blue-50',
        'TENSION': 'bg-red-500 text-red-50',
        'HORS TONALITÉ': 'bg-yellow-500 text-yellow-50'
    };
    
    return (
        <div className={`p-1 w-full sm:w-1/2 md:w-1/3 lg:w-1/4`}>
            <div className={`h-full rounded-lg border-2 p-3 flex flex-col space-y-3 ${frontStyles[analysis.front]}`}>
                <div className="flex justify-between items-start">
                    <h3 className="text-xl font-extrabold text-white">{analysis.accord} <span className="text-base font-semibold text-gray-400">{analysis.degre}</span></h3>
                    <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${badgeStyles[analysis.front]}`}>{analysis.front}</span>
                </div>
                <p className="text-xs font-semibold text-gray-400">{analysis.actionRythmique}</p>
                
                <div>
                    <p className="text-xs font-bold tracking-wider text-purple-400 mb-2">NOTE CIBLE</p>
                    <div className="space-y-1.5">
                        {analysis.allTargetOptions.map((item, index) => {
                            const isSelected = selectedNote?.note === item.note && selectedNote?.interval === item.interval;
                            return (
                                <button
                                    key={index}
                                    onClick={() => onSelectNote(item)}
                                    className={`w-full text-left p-2 rounded-md text-sm transition-all duration-200 ${
                                        isSelected
                                            ? 'bg-purple-500 text-white shadow-lg'
                                            : 'bg-gray-700/50 hover:bg-gray-600/50'
                                    }`}
                                >
                                    <span className="font-bold">{item.note} ({item.interval})</span> - <span className="text-gray-300">{item.intention}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};


const INITIAL_GAMIFICATION_DATA: GamificationData = { xp: 0, level: 1, timePlayed: 0 };

export default function App() {
    const [chords, setChords] = useState<string[]>(Array(TOTAL_CELLS).fill(''));
    const [analysis, setAnalysis] = useState<FullAnalysis | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedNotes, setSelectedNotes] = useState<{ [key: number]: TargetNote }>({});

    const [playerState, setPlayerState] = useState<PlayerState>(PlayerState.Stopped);
    const [currentBeat, setCurrentBeat] = useState(-1);
    const [tempo, setTempo] = useState(60);
    const [volumes, setVolumes] = useState({ metro: -12, bass: -6, chord: -14 });
    
    const [gamificationData, setGamificationData] = useState<GamificationData>(INITIAL_GAMIFICATION_DATA);
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

    const synths = useRef<{ bass?: MonoSynth, chord?: PolySynth, metro?: MembraneSynth }>({}).current;
    const transportPart = useRef<Part | null>(null);
    const countdownPart = useRef<Part | null>(null);
    const debouncedAnalysis = useRef<ReturnType<typeof setTimeout>>();
    const debouncedSave = useRef<ReturnType<typeof setTimeout>>();

    // Auth state listener
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                setCurrentUser(user);
                const userDocRef = doc(db, 'users', user.uid);
                const userDoc = await getDoc(userDocRef);
                if (userDoc.exists()) {
                    setGamificationData(userDoc.data() as GamificationData);
                }
            } else {
                setCurrentUser(null);
                setGamificationData(INITIAL_GAMIFICATION_DATA);
            }
        });
        return () => unsubscribe();
    }, []);
    
    // Debounced Firestore save
    useEffect(() => {
        if (currentUser) {
            if (debouncedSave.current) clearTimeout(debouncedSave.current);
            debouncedSave.current = setTimeout(async () => {
                await setDoc(doc(db, 'users', currentUser.uid), gamificationData, { merge: true });
            }, 2000);
        }
         return () => {
            if (debouncedSave.current) clearTimeout(debouncedSave.current);
        };
    }, [gamificationData, currentUser]);


    const handleChordChange = (index: number, value: string) => {
        const newChords = [...chords];
        newChords[index] = value;
        setChords(newChords);
    };

    const triggerAnalysis = useCallback(() => {
        if (debouncedAnalysis.current) clearTimeout(debouncedAnalysis.current);
        debouncedAnalysis.current = setTimeout(async () => {
            const activeChords = chords.filter(c => c.trim() !== '');
            if (activeChords.length === 0) {
                setAnalysis(null);
                return;
            }
            setIsLoading(true);
            setError(null);
            try {
                const result = await analyzeProgressionWithGemini(chords);
                setAnalysis(result);
                // Auto-select the root note as the default target note for each chord
                if(result) {
                    const defaultNotes: { [key: number]: TargetNote } = {};
                    result.progressionAnalysis.forEach((chordAnalysis, index) => {
                        const rootNote = chordAnalysis.allTargetOptions.find(opt => opt.interval === 'R');
                        if(rootNote) {
                            defaultNotes[index] = rootNote;
                        }
                    });
                    setSelectedNotes(defaultNotes);
                }
            } catch (e) {
                setError("Failed to analyze progression.");
                console.error(e);
            } finally {
                setIsLoading(false);
            }
        }, 1000);
    }, [chords]);
    
    useEffect(() => {
        triggerAnalysis();
    }, [chords, triggerAnalysis]);

    useEffect(() => {
        // Standardize synth initialization to prevent runtime errors.
        // This pattern of using a parameter-less constructor and then .set() is the most robust.
        synths.bass = new MonoSynth().toDestination();
        synths.bass.set({ oscillator: { type: 'fatsawtooth' }, envelope: { attack: 0.01, decay: 0.2, sustain: 0.1, release: 0.5 } });
        
        synths.chord = new PolySynth(Synth).toDestination();
        synths.chord.set({ oscillator: { type: "fatsawtooth", count: 3, spread: 30 }, envelope: { attack: 0.4, decay: 0.1, sustain: 0.8, release: 1.5 } });

        synths.metro = new MembraneSynth().toDestination();
        synths.metro.set({ pitchDecay: 0.01, octaves: 4, oscillator: { type: 'square' }, envelope: { attack: 0.001, decay: 0.1, sustain: 0.01, release: 0.1 } });
        
        return () => {
            synths.bass?.dispose();
            synths.chord?.dispose();
            synths.metro?.dispose();
            Transport.cancel(0);
        };
    }, []);

    useEffect(() => {
        Transport.bpm.value = tempo;
        if(synths.metro) synths.metro.volume.value = volumes.metro;
        if(synths.bass) synths.bass.volume.value = volumes.bass;
        if(synths.chord) synths.chord.volume.value = volumes.chord;
    }, [tempo, volumes, synths]);

    useEffect(() => {
        let timer: ReturnType<typeof setTimeout>;
        if (playerState === PlayerState.Playing) {
            timer = setInterval(() => {
                setGamificationData(prev => {
                    const newXp = prev.xp + GAMIFICATION_XP_PER_SECOND;
                    const newLevel = prev.level + Math.floor(newXp / GAMIFICATION_XP_PER_LEVEL);
                    return {
                        ...prev,
                        timePlayed: prev.timePlayed + 1,
                        xp: newXp % GAMIFICATION_XP_PER_LEVEL,
                        level: newLevel,
                    };
                });
            }, 1000);
        }
        return () => clearInterval(timer);
    }, [playerState]);

    const analysisByCell = useMemo(() => {
        if (!analysis) return [];
        const result: (ChordAnalysis | undefined)[] = Array(TOTAL_CELLS).fill(undefined);
        let analysisIndex = 0;
        chords.forEach((chord, cellIndex) => {
            if (chord.trim() !== '' && analysis.progressionAnalysis[analysisIndex]) {
                result[cellIndex] = analysis.progressionAnalysis[analysisIndex];
                analysisIndex++;
            }
        });
        return result;
    }, [analysis, chords]);

    const cellToAnalysisIndexMap = useMemo(() => {
        if (!analysis) return {};
        const map: { [key: number]: number } = {};
        let analysisIndex = 0;
        chords.forEach((chord, cellIndex) => {
            if (chord.trim() !== '') {
                if (analysis.progressionAnalysis[analysisIndex]) {
                    map[cellIndex] = analysisIndex;
                    analysisIndex++;
                }
            }
        });
        return map;
    }, [analysis, chords]);

    const stopPlayback = useCallback(() => {
        Transport.stop();
        Transport.cancel(0);
        transportPart.current?.dispose();
        countdownPart.current?.dispose();
        // FIX: The `triggerRelease` and `releaseAll` methods were being called without a
        // required time argument, causing an "Expected 1 arguments, but got 0" error.
        // Passing Tone.js's `context.currentTime` ensures the release is scheduled correctly.
        synths.bass?.triggerRelease(context.currentTime);
        synths.chord?.releaseAll(context.currentTime);
        setPlayerState(PlayerState.Stopped);
        setCurrentBeat(-1);
    }, [synths]);


    const startPlayback = useCallback(() => {
        const activeChords = chords.map((c, i) => ({ chord: c, index: i })).filter(item => item.chord.trim() !== '');
        if (activeChords.length === 0) return;

        const lastChordCellIndex = Math.max(...activeChords.map(c => c.index));
        const totalBeatsInProgression = (lastChordCellIndex + 1) * 2;
        const loopEndMeasures = Math.ceil(totalBeatsInProgression / 4);

        if (loopEndMeasures === 0) return;
        
        const events: any[] = [];
        let chordMap = new Map<number, string>();
        chords.forEach((c, i) => { if (c.trim()) chordMap.set(i, c.trim())});
        
        for(let i=0; i<loopEndMeasures * 4; i++) { // For each beat in the loop
            const time = `0:${i}`;
            const cellIndex = Math.floor(i / 2);
            
            events.push({ time, beat: i, type: 'highlight' });
            events.push({ time, note: i % 4 === 0 ? 'C5' : 'C4', type: 'metro' });

            if(i % 2 === 0 && chordMap.has(cellIndex)) {
                const chordName = chordMap.get(cellIndex)!;
                const rootNote = chordName.match(/^[A-G][#b]?/)?.[0];
                const chordAnalysis = analysisByCell[cellIndex];

                if(rootNote) {
                    let nextChangeBeat = totalBeatsInProgression;
                    for(let j=cellIndex+1; j <= lastChordCellIndex; j++) {
                        if(chordMap.has(j)) {
                            nextChangeBeat = j * 2;
                            break;
                        }
                    }
                    const durationBeats = nextChangeBeat - (i);
                    const duration = `0:${durationBeats}`;
                    
                    events.push({ time, note: rootNote + '2', duration, type: 'bass' });
                    if (chordAnalysis && chordAnalysis.notes && chordAnalysis.notes.length > 0) {
                        events.push({ time, notes: chordAnalysis.notes.map(n => n+'4'), duration, type: 'chord' });
                    }
                }
            }
        }
        
        transportPart.current = new Part((time, value) => {
            if (value.type === 'highlight') {
                Draw.schedule(() => setCurrentBeat(value.beat), time);
            } else if (value.type === 'metro' && synths.metro) {
                synths.metro.triggerAttackRelease(value.note, '16n', time);
            } else if (value.type === 'bass' && synths.bass) {
                synths.bass.triggerAttackRelease(value.note, value.duration, time);
            } else if (value.type === 'chord' && synths.chord) {
                synths.chord.triggerAttackRelease(value.notes, value.duration, time);
            }
        }, events).start('1m');
        transportPart.current.loop = true;
        transportPart.current.loopEnd = `${loopEndMeasures}m`;
        
        countdownPart.current = new Part((time, value) => {
             if (synths.metro) synths.metro.triggerAttackRelease('C5', '8n', time);
             Draw.schedule(() => setCurrentBeat(value.beat), time);
        }, [{time: '0:0', beat: -4}, {time: '0:1', beat: -3}, {time: '0:2', beat: -2}, {time: '0:3', beat: -1}]).start(0);

        Transport.loop = true;
        Transport.loopStart = '1m';
        Transport.loopEnd = `${loopEndMeasures + 1}m`;
        
        Transport.scheduleOnce(() => {
            setPlayerState(PlayerState.Playing);
        }, '1m');

        Transport.start();
        setPlayerState(PlayerState.CountingDown);
    }, [chords, synths, analysisByCell]);


    const handlePlayStop = async () => {
        if (context.state !== 'running') await start();
        if (playerState !== PlayerState.Stopped) {
            stopPlayback();
        } else {
            startPlayback();
        }
    };

    const getHighlightedNotes = useCallback((): { note: string; color: string; isBlinking: boolean; }[] => {
        if (!analysis?.progressionAnalysis.length) return [];

        if (playerState === PlayerState.Stopped) {
            const firstAnalysisIndex = cellToAnalysisIndexMap[Object.keys(cellToAnalysisIndexMap)[0]];
             if (firstAnalysisIndex === undefined) return [];
            const firstAnalysis = analysis.progressionAnalysis[firstAnalysisIndex];
            const selectedNote = selectedNotes[firstAnalysisIndex] ?? firstAnalysis.allTargetOptions.find(o => o.interval === 'R');
            return selectedNote ? [{ note: selectedNote.note, color: '#a855f7', isBlinking: false }] : []; // Purple, static
        }
        
        if (playerState === PlayerState.CountingDown) {
            const firstAnalysisIndex = cellToAnalysisIndexMap[Object.keys(cellToAnalysisIndexMap)[0]];
            if (firstAnalysisIndex === undefined) return [];
            const firstAnalysis = analysis.progressionAnalysis[firstAnalysisIndex];
            const selectedNote = selectedNotes[firstAnalysisIndex] ?? firstAnalysis.allTargetOptions.find(o => o.interval === 'R');
            return selectedNote ? [{ note: selectedNote.note, color: '#facc15', isBlinking: false }] : []; // Yellow, static
        }

        // Player is Playing
        const currentCellIndex = Math.floor(currentBeat / 2);

        let currentAnalysisIndex = -1;
        for (let i = currentCellIndex; i >= 0; i--) {
            if (cellToAnalysisIndexMap[i] !== undefined) {
                currentAnalysisIndex = cellToAnalysisIndexMap[i];
                break;
            }
        }
        if (currentAnalysisIndex === -1) return [];

        let nextAnalysisIndex = -1;
        for (let i = currentCellIndex + 1; i < TOTAL_CELLS; i++) {
             if (cellToAnalysisIndexMap[i] !== undefined) {
                nextAnalysisIndex = cellToAnalysisIndexMap[i];
                break;
            }
        }
        if (nextAnalysisIndex === -1) { // Loop back to the beginning
            const firstCellWithChord = Object.keys(cellToAnalysisIndexMap).map(Number).sort((a, b) => a-b)[0];
            nextAnalysisIndex = cellToAnalysisIndexMap[firstCellWithChord];
        }

        if (nextAnalysisIndex === undefined) return [];
        
        const currentAnalysis = analysis.progressionAnalysis[currentAnalysisIndex];
        const nextAnalysis = analysis.progressionAnalysis[nextAnalysisIndex];
        if (!currentAnalysis || !nextAnalysis) return [];
        
        const notes = [];
        const currentSelectedNote = selectedNotes[currentAnalysisIndex] ?? currentAnalysis.allTargetOptions.find(o => o.interval === 'R');
        if (currentSelectedNote) {
            notes.push({ note: currentSelectedNote.note, color: '#a855f7', isBlinking: true }); // Purple, blinking
        }
        
        const nextSelectedNote = selectedNotes[nextAnalysisIndex] ?? nextAnalysis.allTargetOptions.find(o => o.interval === 'R');
        if (nextSelectedNote && nextSelectedNote.note !== currentSelectedNote?.note) {
             notes.push({ note: nextSelectedNote.note, color: '#facc15', isBlinking: false }); // Yellow, static
        }
        
        return notes;
    }, [analysis, playerState, currentBeat, selectedNotes, cellToAnalysisIndexMap]);


    const handleSelectNote = (analysisIndex: number, note: TargetNote) => {
        setSelectedNotes(prev => ({ ...prev, [analysisIndex]: note }));
    };

    const loadPreset = () => {
        const preset = PRESET_PROGRESSIONS[Math.floor(Math.random() * PRESET_PROGRESSIONS.length)];
        const newChords = Array(TOTAL_CELLS).fill('');
        preset.chords.forEach((c, i) => newChords[i] = c);
        setChords(newChords);
    };

    const clearGrid = () => {
        setChords(Array(TOTAL_CELLS).fill(''));
        setAnalysis(null);
    };

    return (
        <>
            <div className="min-h-screen p-2 sm:p-4 pb-32">
                <div className="w-full max-w-7xl mx-auto flex flex-col gap-4">
                    <header className="flex justify-between items-center py-4">
                        <div className="text-left">
                            <h1 className="text-3xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-500 mb-1">
                                🎸 GIA Navigator
                            </h1>
                            <p className="text-md text-gray-400">Votre plan d'action visuel pour l'improvisation.</p>
                        </div>
                         <div className="flex items-center gap-4">
                            {currentUser ? (
                                <>
                                    <div className="text-right">
                                        <p className="text-sm text-gray-300 truncate">{currentUser.email}</p>
                                        <button onClick={() => signOut(auth)} className="text-xs text-red-400 hover:underline">Déconnexion</button>
                                    </div>
                                    <UserIcon className="w-8 h-8 text-gray-400"/>
                                </>
                            ) : (
                                <button onClick={() => setIsAuthModalOpen(true)} className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-gray-300 font-semibold py-2 px-4 rounded-lg transition">
                                    <UserIcon className="w-5 h-5"/>
                                    <span>Connexion / Inscription</span>
                                </button>
                            )}
                        </div>
                    </header>

                    <main className="flex flex-col gap-4">
                        {/* Input & Player Section */}
                        <section className="p-4 bg-gray-900/50 rounded-xl border border-gray-800">
                             <div className="flex justify-between items-center mb-4">
                                <h2 className="text-lg font-bold text-white">1. Entrez votre grille (1 case = 2 temps)</h2>
                                <div className="flex gap-2">
                                    <button onClick={loadPreset} className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 font-semibold py-1.5 px-3 rounded-lg transition">🎲 Aléatoire</button>
                                    <button onClick={clearGrid} className="text-xs bg-red-800/50 hover:bg-red-700 text-white font-semibold py-1.5 px-3 rounded-lg transition">🗑️ Vider</button>
                                </div>
                            </div>

                            <div className="grid grid-cols-8 gap-1 mb-4">
                                {chords.map((chord, i) => {
                                    const currentCell = Math.floor(currentBeat / 2);
                                    const isActive = playerState === PlayerState.Playing && i === currentCell;
                                    return (
                                        <input
                                            key={i}
                                            type="text"
                                            value={chord}
                                            onChange={(e) => handleChordChange(i, e.target.value)}
                                            className={`w-full p-2 text-center font-bold text-white bg-gray-800 border border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all duration-150 ${
                                                isActive ? 'ring-2 ring-blue-400 shadow-lg shadow-blue-400/20' : ''
                                            }`}
                                        />
                                    );
                                })}
                            </div>

                            <GuitarNeck highlightedNotes={getHighlightedNotes()} scaleNotes={analysis?.notesGamme} />
                            
                            <div className="mt-4 flex flex-col md:flex-row items-center justify-between gap-4 p-3 bg-gray-900 rounded-lg">
                                <button onClick={handlePlayStop} disabled={playerState === PlayerState.CountingDown} className="w-full md:w-auto flex items-center justify-center gap-3 px-6 py-3 font-bold text-white bg-emerald-600 rounded-lg hover:bg-emerald-500 transition-all duration-200 disabled:bg-gray-500 disabled:cursor-wait">
                                    {playerState === PlayerState.Stopped && <PlayIcon className="w-6 h-6" />}
                                    {playerState !== PlayerState.Stopped && <StopIcon className="w-6 h-6" />}
                                    <span>{
                                        playerState === PlayerState.Stopped ? 'Play' :
                                        playerState === PlayerState.CountingDown ? `Décompte ${4 - (currentBeat * -1 - 1)}` :
                                        'Stop'
                                    }</span>
                                </button>
                                <div className="w-full md:w-auto flex items-center gap-3">
                                    <label htmlFor="tempo" className="font-semibold text-gray-300">Tempo:</label>
                                    <input type="range" id="tempo" min="40" max="200" value={tempo} onChange={e => setTempo(Number(e.target.value))} className="w-full"/>
                                    <span className="w-16 text-center font-bold">{tempo} bpm</span>
                                </div>
                            </div>
                        </section>

                        {/* Analysis Section */}
                        <section className="p-4 bg-gray-900/50 rounded-xl border border-gray-800">
                             <h2 className="text-lg font-bold text-white mb-1">2. Votre Plan d'Action GIA</h2>
                             {isLoading ? (
                                <div className="flex items-center justify-center h-48 gap-3 text-gray-400">
                                    <LoadingSpinner className="w-8 h-8"/>
                                    <span>Analyse par IA en cours...</span>
                                </div>
                             ) : error ? (
                                <div className="text-red-400 text-center h-48 flex items-center justify-center">{error}</div>
                             ) : analysis ? (
                                <>
                                    <div className="flex items-baseline gap-4 mb-4">
                                        <p className="font-semibold text-blue-300">Tonalité: {analysis.tonalite}</p>
                                        <div className="flex gap-2 items-center text-sm text-gray-300 flex-wrap">
                                            {analysis.notesGamme.map(n => <span key={n} className="font-mono bg-gray-700 px-1.5 py-0.5 rounded-md">{n}</span>)}
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap -m-1">
                                    {analysis.progressionAnalysis.map((item, index) => (
                                        <AnalysisCard 
                                            key={index}
                                            analysis={item}
                                            analysisIndex={index}
                                            onSelectNote={(note) => handleSelectNote(index, note)}
                                            selectedNote={selectedNotes[index]}
                                        />
                                    ))}
                                    </div>
                                </>
                             ) : (
                                 <div className="text-gray-500 text-center h-48 flex items-center justify-center">Entrez une grille d'accords pour commencer l'analyse.</div>
                             )}
                        </section>

                    </main>
                </div>
            </div>
            <GamificationDashboard data={gamificationData} />
            <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
        </>
    );
}