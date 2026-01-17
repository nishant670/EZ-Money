import React from 'react';
import { useRouter } from 'expo-router';
import { AuthPinSetupScreen } from '@/components/auth/AuthPinSetupScreen';
import { useAuthStore } from '@/hooks/use-auth-store';

export default function ChangePinScreen() {
    const router = useRouter();
    const { updateUser } = useAuthStore();
    const [loading, setLoading] = React.useState(false);

    const handleComplete = async (pin: string) => {
        setLoading(true);
        try {
            // In a real app, this would be an API call to update the PIN on the server
            // For now, we update the local store state
            updateUser({ has_pin: true });
            router.back();
        } catch (error) {
            console.error('Failed to update PIN:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <AuthPinSetupScreen
            onComplete={handleComplete}
            onCancel={() => router.back()}
            isLoading={loading}
        />
    );
}
