import { getFirebaseMode } from '../constants';

/**
 * Returns the collection name based on the current Firebase mode.
 * If mode is 'test', returns 'test_baseName'.
 * Otherwise returns 'baseName'.
 */
export const getCollectionName = (baseName: string): string => {
  const mode = getFirebaseMode();
  if (mode === 'test') {
    return `test_${baseName}`;
  }
  return baseName;
};
