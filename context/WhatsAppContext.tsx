import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { checkConnectionStatus } from '../services/evolutionService';
import { useRestaurants } from './RestaurantContext';

interface WhatsAppContextType {
  isConnected: boolean;
  isChecking: boolean;
  refreshStatus: () => Promise<void>;
}

const WhatsAppContext = createContext<WhatsAppContextType | undefined>(undefined);

export const WhatsAppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { selectedRestaurant } = useRestaurants();
  const [isConnected, setIsConnected] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  const refreshStatus = async () => {
    setIsChecking(true);
    try {
      // Use the same naming convention as CRM.tsx
      const instanceName = selectedRestaurant?.id ? `CraveWave_${selectedRestaurant.id}` : 'admin';
      const status = await checkConnectionStatus(instanceName);
      setIsConnected(status === 'open');
    } catch (error) {
      console.error('Error checking WhatsApp status:', error);
      setIsConnected(false);
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    refreshStatus();
    // Check every 5 minutes
    const interval = setInterval(refreshStatus, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [selectedRestaurant?.id]);

  return (
    <WhatsAppContext.Provider value={{ isConnected, isChecking, refreshStatus }}>
      {children}
    </WhatsAppContext.Provider>
  );
};

export const useWhatsApp = () => {
  const context = useContext(WhatsAppContext);
  if (!context) throw new Error('useWhatsApp must be used within a WhatsAppProvider');
  return context;
};
