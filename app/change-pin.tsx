import React from 'react';
import { useRouter } from 'expo-router';
import { AuthPinSetupScreen } from '@/components/auth/AuthPinSetupScreen';
import { useAuthStore } from '@/hooks/use-auth-store';
import { saveLocalSecurityPin } from '@/lib/security';

export default function ChangePinScreen() {
    const router = useRouter();
    const { user, updateUser } = useAuthStore();
    const [loading, setLoading] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    const handleComplete = async (pin: string) => {
        if (!user?.uuid) {
            setError('Sign in again before setting an app PIN.');
            return;
        }
        setLoading(true);
        setError(null);
        try {
            await saveLocalSecurityPin(user.uuid, pin);
            updateUser({ has_pin: true });
            router.back();
        } catch (error) {
            console.error('Failed to update PIN:', error);
            setError(error instanceof Error ? error.message : 'Failed to update PIN.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <AuthPinSetupScreen
            onComplete={handleComplete}
            onCancel={() => router.back()}
            isLoading={loading}
            errorMessage={error}
        />
    );
}
