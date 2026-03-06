import { Restaurant } from './types';

export const RESTAURANTS: Restaurant[] = [];

// API & Server Config
export const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
export const EVOLUTION_API_KEY = import.meta.env.VITE_EVOLUTION_API_KEY;
export const EVOLUTION_SERVER_URL = import.meta.env.VITE_EVOLUTION_SERVER_URL;

// Database Mode
export const getFirebaseMode = (): 'live' | 'test' => {
  const config = localStorage.getItem('app_config');
  if (config) {
    const parsed = JSON.parse(config);
    return parsed.dbConfig?.firebaseMode || 'test';
  }
  return 'test';
};
