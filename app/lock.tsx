import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AuthPinLoginScreen } from '@/components/auth/AuthPinLoginScreen';
import { Colors } from '@/constants/theme';
import { useAuthStore } from '@/hooks/use-auth-store';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { loginUser } from '@/lib/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

const DEVICE_ID_KEY = 'ez_money_device_id';

export default function LockScreen() {
    const router = useRouter();
    const colorScheme = useColorScheme() ?? 'light';
    const theme = Colors[colorScheme];
    const { user, setAuth, clearAuth } = useAuthStore();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleUnlock = async (pin: string) => {
        if (!user) {
            clearAuth();
            router.replace('/onboarding');
            return;
        }

        if (pin === 'biometric_success') {
            router.replace('/(tabs)');
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const deviceId = await AsyncStorage.getItem(DEVICE_ID_KEY) || 'unknown_device';

            // We use the stored user info to attempt a login
            // For guests or users, we need an identifier.
            // If none explicitly (like a pure guest initially), we might rely on device_id backend logic 
            // or assume the UUID/Username is the identifier. 
            // Adjusted loginUser logic might be needed if "identifier" isn't just email/phone.
            // BUT per previous flow, we use email/phone. 
            // Guests don't exactly "login" with PIN in the same way via /login endpoint unless it handles username?
            // Let's assume for now we try to login with available info.

            const identifier = user.email || user.phone || user.username;

            const response = await loginUser({
                identifier: identifier,
                pin: pin,
                device_id: deviceId,
            });

            setAuth(response.user, response.token);
            router.replace('/(tabs)');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unlock failed. If you reset your account, please Switch Account.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
            <AuthPinLoginScreen
                onContinue={handleUnlock}
                onSecondary={() => {
                    clearAuth(); // Clear stale user data
                    router.replace('/onboarding');
                }}
                isLoading={isLoading}
                errorMessage={error}
            />
        </SafeAreaView>
    );
}
