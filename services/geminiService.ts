
import { GoogleGenAI, Type } from "@google/genai";
import { FullAnalysis } from '../types';

export const analyzeProgressionWithGemini = async (progression: string[]): Promise<FullAnalysis | null> => {
    if (!process.env.API_KEY) {
        console.error("API_KEY environment variable not set.");
        // Mock response for development without API key
        return {
            tonalite: "C Majeur",
            notesGamme: ["C", "D", "E", "F", "G", "A", "B"],
            progressionAnalysis: progression.filter(c => c).map((c, i) => ({
                accord: c,
                degre: ["I", "V", "vi", "IV"][i % 4],
                // FIX: Add mock notes to satisfy the updated FullAnalysis type.
                notes: [c.charAt(0), "E", "G"],
                front: "RÉSOLUTION",
                actionRythmique: "LENT / LYRIQUE",
                allTargetOptions: [
                    { note: c.charAt(0), interval: "R", intention: "Stabilité", description: "", type: "fondatrice" },
                    { note: "E", interval: "3M", intention: "Couleur", description: "", type: "fondatrice" },
                    { note: "D", interval: "9e", intention: "Lyrisme", description: "", type: "expressive" },
                ]
            }))
        };
    }
    
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    const prompt = `Analyse la progression d'accords suivante pour un guitariste improvisateur: ${progression.join(' ')}.
    1. Détermine la tonalité la plus probable (ex: "C Majeur", "A mineur").
    2. Liste les notes de la gamme correspondante.
    3. Pour chaque accord de la progression (ignore les cases vides), fournis une analyse détaillée.
    - accord: Le nom de l'accord.
    - degre: Le degré de l'accord dans la tonalité (ex: "I", "V7", "vi").
    - notes: La liste des notes qui composent l'accord (ex: ["C", "E", "G"]).
    - front: Classifie l'accord comme "RÉSOLUTION" (stable), "TENSION" (dominant, veut résoudre), ou "HORS TONALITÉ" (inattendu, crée une surprise).
    - actionRythmique: Suggère une approche rythmique: "LENT / LYRIQUE" pour la résolution, "RAPIDE / AGRESSIF" pour la tension.
    - allTargetOptions: Propose des notes cibles pour l'improvisation, en incluant des notes fondatrices (R, 3, 5, 7) et des notes expressives (9, 11, 13, altérations), avec une brève description de leur "intention" (ex: "Stabilité", "Couleur", "Tension Ultime").`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        tonalite: { type: Type.STRING, description: "La tonalité de la progression." },
                        notesGamme: { type: Type.ARRAY, items: { type: Type.STRING } },
                        progressionAnalysis: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    accord: { type: Type.STRING },
                                    degre: { type: Type.STRING },
                                    // FIX: Add notes property to schema to get chord notes from the model.
                                    notes: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Les notes composant l'accord." },
                                    front: { type: Type.STRING, enum: ["TENSION", "RÉSOLUTION", "HORS TONALITÉ"] },
                                    actionRythmique: { type: Type.STRING, enum: ["RAPIDE / AGRESSIF", "LENT / LYRIQUE"] },
                                    allTargetOptions: {
                                        type: Type.ARRAY,
                                        items: {
                                            type: Type.OBJECT,
                                            properties: {
                                                note: { type: Type.STRING },
                                                interval: { type: Type.STRING },
                                                intention: { type: Type.STRING },
                                                description: { type: Type.STRING },
                                                type: { type: Type.STRING, enum: ['fondatrice', 'expressive'] }
                                            },
                                            required: ["note", "interval", "intention", "description", "type"]
                                        }
                                    }
                                },
                                // FIX: Make 'notes' a required field in the response.
                                required: ["accord", "degre", "notes", "front", "actionRythmique", "allTargetOptions"]
                            }
                        }
                    },
                    required: ["tonalite", "notesGamme", "progressionAnalysis"]
                }
            }
        });

        const jsonText = response.text.trim();
        const result = JSON.parse(jsonText) as FullAnalysis;
        return result;

    } catch (error) {
        console.error("Error calling Gemini API:", error);
        return null;
    }
};