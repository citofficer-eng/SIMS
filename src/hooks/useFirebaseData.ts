import { useState, useEffect, useRef } from 'react';

/**
 * Hook to subscribe to Firebase Realtime Database and get live updates.
 * Falls back to mock API if Firebase is not available.
 * @param fetcher Initial data fetcher (for mock mode or first load)
 * @param firebaseListenerSetup Function that sets up the Firebase listener
 */
export function useFirebaseData<T>(
    fetcher: () => Promise<T>,
    firebaseListenerSetup: (onUpdate: (data: T) => void) => (() => void)
): { data: T | null; loading: boolean; refetch: () => void } {
    const [data, setData] = useState<T | null>(null);
    const [loading, setLoading] = useState(true);
    const unsubscribeRef = useRef<(() => void) | null>(null);

    useEffect(() => {
        let isMounted = true;

        // Initial fetch
        const doInitialFetch = async () => {
            try {
                const result = await fetcher();
                if (isMounted) {
                    setData(result);
                }
            } catch (e) {
                console.warn('Initial fetch failed', e);
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        };

        doInitialFetch();

        // Set up Firebase listener
        const unsubscribe = firebaseListenerSetup((newData: T) => {
            if (isMounted) {
                setData(newData);
            }
        });

        unsubscribeRef.current = unsubscribe;

        return () => {
            isMounted = false;
            if (unsubscribeRef.current) {
                unsubscribeRef.current();
            }
        };
    }, []);

    const refetch = () => {
        fetcher().then(result => setData(result)).catch(e => console.warn('Refetch failed', e));
    };

    return { data, loading, refetch };
}
