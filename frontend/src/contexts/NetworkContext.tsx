import React, { createContext, useContext, useEffect, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';

interface NetworkCtx {
  isOnline: boolean;
  isInternetReachable: boolean | null;
  type: string | null;
}

const NetworkContext = createContext<NetworkCtx>({
  isOnline: true,
  isInternetReachable: null,
  type: null,
});

export function NetworkProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<NetworkCtx>({
    isOnline: true,
    isInternetReachable: null,
    type: null,
  });

  useEffect(() => {
    // Get initial state
    NetInfo.fetch().then((info) => {
      setState({
        isOnline: info.isConnected ?? true,
        isInternetReachable: info.isInternetReachable,
        type: info.type,
      });
    });

    // Subscribe to network state changes
    const unsubscribe = NetInfo.addEventListener((info) => {
      setState({
        isOnline: info.isConnected ?? true,
        isInternetReachable: info.isInternetReachable,
        type: info.type,
      });
    });

    return () => unsubscribe();
  }, []);

  return <NetworkContext.Provider value={state}>{children}</NetworkContext.Provider>;
}

export function useNetwork() {
  return useContext(NetworkContext);
}
