
import React, { useState, useEffect } from 'react';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, AuthError } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import { LoadingSpinner, XIcon } from './icons';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      // Reset form on close
      setEmail('');
      setPassword('');
      setError(null);
      setIsLoading(false);
      setActiveTab('login');
    }
  }, [isOpen]);

  const getFirebaseErrorMessage = (errorCode: string): string => {
    switch (errorCode) {
      case 'auth/invalid-email':
        return 'Adresse email invalide.';
      case 'auth/user-not-found':
      case 'auth/wrong-password':
        return 'Email ou mot de passe incorrect.';
      case 'auth/email-already-in-use':
        return 'Cette adresse email est déjà utilisée.';
      case 'auth/weak-password':
        return 'Le mot de passe doit contenir au moins 6 caractères.';
      default:
        return 'Une erreur est survenue. Veuillez réessayer.';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      if (activeTab === 'login') {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        // Create user document in Firestore
        await setDoc(doc(db, "users", userCredential.user.uid), {
            xp: 0,
            level: 1,
            timePlayed: 0
        });
      }
      onClose();
    } catch (err) {
      const authError = err as AuthError;
      setError(getFirebaseErrorMessage(authError.code));
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="w-full max-w-sm bg-gray-900 rounded-2xl border border-gray-700 shadow-2xl shadow-purple-500/10 p-8" onClick={e => e.stopPropagation()}>
        <div className="flex justify-end">
             <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
                <XIcon className="w-6 h-6"/>
            </button>
        </div>
        
        <div className="mb-6">
          <div className="flex border-b border-gray-700">
            <button
              onClick={() => setActiveTab('login')}
              className={`w-1/2 py-3 text-sm font-bold transition-colors ${activeTab === 'login' ? 'text-purple-400 border-b-2 border-purple-400' : 'text-gray-400 hover:text-white'}`}
            >
              CONNEXION
            </button>
            <button
              onClick={() => setActiveTab('signup')}
              className={`w-1/2 py-3 text-sm font-bold transition-colors ${activeTab === 'signup' ? 'text-purple-400 border-b-2 border-purple-400' : 'text-gray-400 hover:text-white'}`}
            >
              INSCRIPTION
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-400 mb-2">Email</label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="vous@email.com"
              />
            </div>
            <div>
              <label htmlFor="password"className="block text-sm font-medium text-gray-400 mb-2">Mot de passe</label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="********"
              />
            </div>
          </div>
          
          {error && <p className="text-red-400 text-sm mt-4 text-center">{error}</p>}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-6 py-3 px-4 bg-purple-600 hover:bg-purple-500 rounded-lg font-semibold text-white transition-all duration-200 flex items-center justify-center disabled:bg-gray-600 disabled:cursor-not-allowed"
          >
            {isLoading ? <LoadingSpinner className="w-5 h-5"/> : (activeTab === 'login' ? 'Se connecter' : "S'inscrire")}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AuthModal;