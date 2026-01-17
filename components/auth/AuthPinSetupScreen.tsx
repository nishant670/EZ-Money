import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type AuthPinSetupScreenProps = {
    onComplete: (pin: string) => void;
    onCancel: () => void;
    isLoading?: boolean;
};

export const AuthPinSetupScreen = ({
    onComplete,
    onCancel,
    isLoading,
}: AuthPinSetupScreenProps) => {
    const colorScheme = useColorScheme() ?? 'light';
    const theme = Colors[colorScheme];

    const [step, setStep] = useState<'create' | 'confirm'>('create');
    const [pin, setPin] = useState('');
    const [confirmPin, setConfirmPin] = useState('');
    const [error, setError] = useState<string | null>(null);

    const handleDigitPress = (digit: string) => {
        if (isLoading) return;
        setError(null);

        if (step === 'create') {
            if (pin.length >= 4) return;
            const nextPin = pin + digit;
            setPin(nextPin);
            if (nextPin.length === 4) {
                setTimeout(() => setStep('confirm'), 300);
            }
        } else {
            if (confirmPin.length >= 4) return;
            const nextConfirmPin = confirmPin + digit;
            setConfirmPin(nextConfirmPin);
            if (nextConfirmPin.length === 4) {
                if (nextConfirmPin === pin) {
                    onComplete(pin);
                } else {
                    setError('PINs do not match. Try again.');
                    setTimeout(() => {
                        setStep('create');
                        setPin('');
                        setConfirmPin('');
                    }, 1000);
                }
            }
        }
    };

    const handleBackspace = () => {
        if (isLoading) return;
        if (step === 'create') {
            setPin(pin.slice(0, -1));
        } else {
            setConfirmPin(confirmPin.slice(0, -1));
        }
    };

    const currentPinLength = step === 'create' ? pin.length : confirmPin.length;
    const title = step === 'create' ? 'Create your PIN' : 'Confirm your PIN';
    const subtitle = step === 'create'
        ? 'This 4-digit code will keep your data private.'
        : "Just one more time to make sure it's correct.";

    return (
        <View style={localStyles.container}>
            {/* Back Button */}
            <TouchableOpacity onPress={onCancel} style={localStyles.backButton}>
                <MaterialCommunityIcons name="arrow-left" size={28} color="#4A4E69" />
            </TouchableOpacity>

            {/* Background Glows (Simulated) */}
            <View style={localStyles.glowTop} />
            <View style={localStyles.glowBottom} />

            <View style={localStyles.headerSection}>
                <Text style={localStyles.title}>{title}</Text>
                <Text style={localStyles.subtitle}>{subtitle}</Text>
            </View>

            <View style={localStyles.dotsContainer}>
                {[0, 1, 2, 3].map((index) => {
                    const isFilled = currentPinLength > index;
                    const isActive = currentPinLength === index;
                    return (
                        <View
                            key={index}
                            style={[
                                localStyles.dotWrapper,
                                isActive && localStyles.dotActive
                            ]}
                        >
                            <View
                                style={[
                                    localStyles.dotInner,
                                    isFilled && localStyles.dotInnerFilled,
                                    isFilled && { width: 12, height: 12, borderRadius: 6 }
                                ]}
                            />
                        </View>
                    );
                })}
            </View>

            {error ? (
                <View style={localStyles.errorContainer}>
                    <Text style={localStyles.errorText}>{error}</Text>
                </View>
            ) : null}

            {isLoading && (
                <ActivityIndicator size="large" color="#FF8A65" style={{ marginBottom: 20 }} />
            )}

            <View style={localStyles.keypadContainer}>
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                    <TouchableOpacity
                        key={digit}
                        style={localStyles.keyPadButton}
                        onPress={() => handleDigitPress(digit)}
                        disabled={isLoading}
                    >
                        <Text style={localStyles.keyPadText}>{digit}</Text>
                    </TouchableOpacity>
                ))}
                {/* Placeholder for alignment if needed, but screenshot shows 0 in middle */}
                <View style={localStyles.emptyKey} />

                <TouchableOpacity
                    style={localStyles.keyPadButton}
                    onPress={() => handleDigitPress('0')}
                    disabled={isLoading}
                >
                    <Text style={localStyles.keyPadText}>0</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[localStyles.keyPadButton, { backgroundColor: 'transparent', shadowOpacity: 0, elevation: 0 }]}
                    onPress={handleBackspace}
                    disabled={isLoading}
                >
                    <MaterialCommunityIcons name="backspace-outline" size={28} color="#9E9EBA" />
                </TouchableOpacity>
            </View>
        </View>
    );
};

const localStyles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FDFBFF',
        paddingTop: 20,
    },
    backButton: {
        padding: 24,
        zIndex: 10,
    },
    glowTop: {
        position: 'absolute',
        top: -50,
        right: -50,
        width: 250,
        height: 250,
        borderRadius: 125,
        backgroundColor: '#FCE4EC',
        opacity: 0.5,
        zIndex: 0,
    },
    glowBottom: {
        position: 'absolute',
        bottom: '20%',
        left: -30,
        width: 200,
        height: 200,
        borderRadius: 100,
        backgroundColor: '#E3F2FD',
        opacity: 0.3,
        zIndex: 0,
    },
    headerSection: {
        alignItems: 'center',
        paddingHorizontal: 50,
        marginTop: 10,
        zIndex: 1,
    },
    title: {
        fontSize: 32,
        fontWeight: '800',
        color: '#1A1C3D',
        textAlign: 'center',
        marginBottom: 16,
        letterSpacing: -0.5,
    },
    subtitle: {
        fontSize: 18,
        color: '#6B6D8E',
        textAlign: 'center',
        lineHeight: 26,
        opacity: 0.8,
    },
    dotsContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 16,
        marginTop: 50,
        marginBottom: 60,
        zIndex: 1,
    },
    dotWrapper: {
        width: 68,
        height: 72,
        borderRadius: 22,
        backgroundColor: '#FFFFFF',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: 'transparent',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.04,
        shadowRadius: 12,
        elevation: 3,
    },
    dotActive: {
        borderColor: '#FFAB91',
        borderWidth: 2.5,
    },
    dotInner: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#E0E0EF',
    },
    dotInnerFilled: {
        backgroundColor: '#FF8A65',
    },
    errorContainer: {
        paddingHorizontal: 40,
        marginBottom: 20,
        alignItems: 'center',
    },
    errorText: {
        color: '#E53935',
        fontSize: 14,
        fontWeight: '600',
    },
    keypadContainer: {
        paddingHorizontal: 30,
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        zIndex: 1,
    },
    keyPadButton: {
        width: '30%',
        aspectRatio: 1.3,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
        borderRadius: 24,
        backgroundColor: '#FFFFFF',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.03,
        shadowRadius: 8,
        elevation: 2,
    },
    keyPadText: {
        fontSize: 28,
        fontWeight: '700',
        color: '#1A1C3D',
    },
    emptyKey: {
        width: '30%',
        aspectRatio: 1.3,
    }
});
