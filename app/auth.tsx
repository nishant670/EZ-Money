import { OnboardingScreenWrapper } from '@/components/onboarding/OnboardingScreenWrapper';
import { useAuthStore } from '@/hooks/use-auth-store';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  SlideInLeft,
  SlideInRight,
  SlideOutLeft,
  SlideOutRight
} from 'react-native-reanimated';

import {
  AuthOTPVerificationScreen,
  AuthPinLoginScreen,
  AuthPinSetupScreen,
  AuthScreen1,
  AuthScreen2,
  AuthScreen3,
  AuthScreen4,
  AuthSecuritySetupScreen
} from '@/components/auth';
import { authOtpSend, guestCheckin, identifyUser, loginUser, registerUser, resetPin } from '@/lib/auth';
import { getDeviceId } from '@/lib/device';

export default function AuthFlow() {
  const router = useRouter();
  const { user, setAuth } = useAuthStore();
  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState<'forward' | 'back'>('forward');
  const [identifier, setIdentifier] = useState('');
  const [claimToken, setClaimToken] = useState<string | null>(null);
  const [identifyError, setIdentifyError] = useState<string | null>(null);
  const [isIdentifying, setIsIdentifying] = useState(false);
  const [guestError, setGuestError] = useState<string | null>(null);
  const [isGuestChecking, setIsGuestChecking] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isSendingResetOtp, setIsSendingResetOtp] = useState(false);
  const [isResettingPin, setIsResettingPin] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  const handleFinish = () => {
    router.replace('/(tabs)');
  };

  const changeStep = (newStep: number, transitionDirection: 'forward' | 'back' = 'forward') => {
    setDirection(transitionDirection);
    setTimeout(() => setStep(newStep), 0);
  };

  const handleGuestContinue = async () => {
    setGuestError(null);
    setIdentifyError(null);
    setIsGuestChecking(true);
    try {
      const deviceId = await getDeviceId();
      const response = await guestCheckin({
        device_id: deviceId,
      });
      if (response?.user) {
        setAuth(response.user, response.token);
      }
      router.replace('/(tabs)');
    } catch (error) {
      setGuestError(error instanceof Error ? error.message : 'Unable to continue as guest.');
    } finally {
      setIsGuestChecking(false);
    }
  };

  const handleRegister = async (data: { pin: string; biometricsEnabled: boolean }) => {
    if (!claimToken) return;
    setIsRegistering(true);
    try {
      const deviceId = await getDeviceId();
      const response = await registerUser({
        claim_token: claimToken,
        pin: data.pin,
        guest_uuid: user?.is_guest ? user.uuid : undefined,
        device_id: deviceId,
        biometrics_enabled: data.biometricsEnabled,
      });
      setAuth(response.user, response.token);
      changeStep(6, 'forward');
    } catch (error) {
      setIdentifyError(error instanceof Error ? error.message : 'Registration failed.');
    } finally {
      setIsRegistering(false);
    }
  };

  const handleLogin = async (pin: string) => {
    if (pin === 'biometric_success') {
      handleFinish();
      return;
    }
    setLoginError(null);
    setIsLoggingIn(true);
    try {
      const deviceId = await getDeviceId();
      const response = await loginUser({
        identifier: identifier,
        pin: pin,
        device_id: deviceId,
      });
      setAuth(response.user, response.token);
      handleFinish();
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : 'Login failed.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleForgotPin = async () => {
    if (!identifier) {
      changeStep(2, 'back');
      return;
    }

    setLoginError(null);
    setResetError(null);
    setClaimToken(null);
    setIsSendingResetOtp(true);
    try {
      await authOtpSend(identifier);
      changeStep(8, 'forward');
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : 'Unable to send reset code.');
    } finally {
      setIsSendingResetOtp(false);
    }
  };

  const handleResetPin = async (pin: string) => {
    if (!claimToken) return;
    setResetError(null);
    setIsResettingPin(true);
    try {
      const deviceId = await getDeviceId();
      const response = await resetPin({
        claim_token: claimToken,
        pin,
        device_id: deviceId,
      });
      setAuth(response.user, response.token);
      handleFinish();
    } catch (error) {
      setResetError(error instanceof Error ? error.message : 'Unable to reset PIN.');
    } finally {
      setIsResettingPin(false);
    }
  };

  const handleIdentify = async (id: string) => {
    setIdentifyError(null);
    setLoginError(null);
    setResetError(null);
    setClaimToken(null);
    setIsIdentifying(true);
    try {
      const result = await identifyUser(id);
      setIdentifier(id);
      if (!result.exists) {
        await authOtpSend(id);
      }
      changeStep(result.exists ? 7 : 3, 'forward');
    } catch (error) {
      setIdentifyError(error instanceof Error ? error.message : 'Unable to verify that identifier.');
    } finally {
      setIsIdentifying(false);
    }
  };

  const renderScreen = () => {
    switch (step) {
      case 1:
        return (
          <AuthScreen1
            onContinue={() => {
              setGuestError(null);
              changeStep(5, 'forward');
            }}
            onSecondary={() => {
              changeStep(2, 'forward');
            }}
          />
        );
      case 2:
        return (
          <AuthScreen2
            onContinue={handleIdentify}
            onSecondary={() => {
              setGuestError(null);
              changeStep(5, 'forward');
            }}
            onInputChange={() => setIdentifyError(null)}
            errorMessage={identifyError}
            isLoading={isIdentifying}
          />
        );
      case 7:
        return (
          <AuthPinLoginScreen
            onContinue={handleLogin}
            onSecondary={() => changeStep(2, 'back')}
            onForgotPin={handleForgotPin}
            errorMessage={loginError}
            isLoading={isLoggingIn || isSendingResetOtp}
          />
        );
      case 3:
        return (
          <AuthOTPVerificationScreen
            data={identifier}
            onContinue={(token: string) => {
              setClaimToken(token);
              changeStep(4, 'forward');
            }}
            onSecondary={() => changeStep(2, 'back')}
          />
        );
      case 8:
        return (
          <AuthOTPVerificationScreen
            data={identifier}
            onContinue={(token: string) => {
              setClaimToken(token);
              changeStep(9, 'forward');
            }}
            onSecondary={() => changeStep(7, 'back')}
          />
        );
      case 9:
        return (
          <AuthPinSetupScreen
            onComplete={handleResetPin}
            onCancel={() => changeStep(7, 'back')}
            isLoading={isResettingPin}
            errorMessage={resetError}
          />
        );
      case 4:
        return (
          <AuthSecuritySetupScreen
            onContinue={handleRegister}
            onSecondary={() => changeStep(3, 'back')}
            isLoading={isRegistering}
            errorMessage={identifyError}
          />
        );
      case 5:
        return (
          <AuthScreen3
            onContinue={handleGuestContinue}
            onSecondary={() => {
              setGuestError(null);
              changeStep(2, 'back');
            }}
            errorMessage={guestError}
            isLoading={isGuestChecking}
          />
        );
      case 6:
        return (
          <AuthScreen4 onContinue={handleFinish} />
        );
      default:
        return null;
    }
  };

  const enteringAnimation = direction === 'forward' ? SlideInRight.duration(400) : SlideInLeft.duration(400);
  const exitingAnimation = direction === 'forward' ? SlideOutLeft.duration(400) : SlideOutRight.duration(400);

  return (
    <OnboardingScreenWrapper>
      <View style={styles.container}>
        <Animated.View
          key={step}
          entering={enteringAnimation}
          exiting={exitingAnimation}
          style={styles.screenContainer}
        >
          {renderScreen()}
        </Animated.View>
      </View>
    </OnboardingScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  screenContainer: {
    flex: 1,
  }
});
