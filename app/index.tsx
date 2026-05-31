import { useAuth } from '@/contexts/AuthContext';
import { router } from 'expo-router';
import { useEffect } from 'react';

export default function Index() {
    const { user, loading } = useAuth();

    useEffect(() => {
        if (!loading) {
            router.replace(user ? '/(tabs)' : '/(auth)/splash');
        }
    }, [user, loading]);

    return null;
}
