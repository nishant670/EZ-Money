import { ThemedText } from '@/components/themed-text';
import { TextAction } from '@/components/ui/theme-primitives';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

type VoiceInputCardProps = {
  onMicPress: () => void;
  isRecording: boolean;
  hasRecording: boolean;
  inputText: string;
  onChangeText: (text: string) => void;
  onProcess: () => void;
  onClear: () => void;
  isProcessing?: boolean;
  isTextInputVisible?: boolean;
  onToggleTextInput?: () => void;
};

export function VoiceInputCard({
  onMicPress,
  isRecording,
  hasRecording,
  inputText,
  onChangeText,
  onProcess,
  onClear,
  isProcessing = false,
  isTextInputVisible = false,
  onToggleTextInput,
}: VoiceInputCardProps) {
  const theme = useThemeTokens();
  const colors = theme.colors;
  const isDark = theme.mode === 'dark';
  const trimmedInput = inputText.trim();
  const canSubmitText = trimmedInput.length > 0 && !isRecording && !isProcessing;
  const shouldShowTextInput = isTextInputVisible || trimmedInput.length > 0;
  const textInputRef = useRef<TextInput>(null);
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const textEntryAnim = useRef(new Animated.Value(shouldShowTextInput ? 1 : 0)).current;
  const promptFade = useRef(new Animated.Value(1)).current;
  const samplePrompts = useMemo(
    () => [
      `Spent 250 on food via UPI`,
      `Got 2000 from freelance`,
      `Paid 1200 rent by bank`,
      `Coffee 180 using card`,
    ],
    []
  );
  const [promptIndex, setPromptIndex] = useState(0);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: isRecording ? 850 : 1800,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0,
          duration: isRecording ? 120 : 260,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();

    return () => loop.stop();
  }, [isRecording, pulseAnim]);

  useEffect(() => {
    Animated.timing(textEntryAnim, {
      toValue: shouldShowTextInput ? 1 : 0,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    if (shouldShowTextInput) {
      const focusTimeout = setTimeout(() => textInputRef.current?.focus(), 160);
      return () => clearTimeout(focusTimeout);
    }

    return undefined;
  }, [shouldShowTextInput, textEntryAnim]);

  useEffect(() => {
    if (isRecording) return undefined;

    const interval = setInterval(() => {
      Animated.timing(promptFade, {
        toValue: 0,
        duration: 260,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (!finished) return;
        setPromptIndex((current) => (current + 1) % samplePrompts.length);
        Animated.timing(promptFade, {
          toValue: 1,
          duration: 320,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }).start();
      });
    }, 2600);

    return () => clearInterval(interval);
  }, [isRecording, promptFade, samplePrompts.length]);

  const pulseScale = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, isRecording ? 1.28 : 1.16],
  });
  const pulseOpacity = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [isRecording ? 0.26 : 0.18, 0],
  });

  // Success State UI
  if (hasRecording && !isRecording) {
    return (
      <View
        style={{
          marginHorizontal: 24,
          borderRadius: theme.radius.xxl,
          paddingHorizontal: theme.spacing.lg,
          paddingTop: theme.spacing.xxl,
          paddingBottom: theme.spacing.xl,
          minHeight: 262,
          alignItems: 'center',
          justifyContent: 'center',
          gap: theme.spacing.xl,
          backgroundColor: isDark ? colors.card : colors.secondary,
        }}>
        <View style={{ alignItems: 'center', gap: theme.spacing.xs }}>
          <View
            style={{
              height: 64,
              width: 64,
              borderRadius: 32,
              backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#FFFFFF',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <MaterialCommunityIcons name="waveform" size={30} color={colors.accent} />
          </View>
          <ThemedText variant="cardTitle" style={{ color: colors.text }}>
            Recording ready
          </ThemedText>
          <ThemedText style={{ ...theme.typography.caption, color: isDark ? 'rgba(255,255,255,0.56)' : 'rgba(45,45,45,0.54)' }}>
            Process it, or cancel to record again.
          </ThemedText>
        </View>

        <View
          style={{
            alignSelf: 'stretch',
            flexDirection: 'row',
            gap: theme.spacing.sm,
          }}>
          <Pressable
            onPress={onProcess}
            disabled={isProcessing}
            style={({ pressed }) => ({
              flex: 1,
              flexBasis: 0,
              minWidth: 0,
              opacity: pressed ? 0.9 : isProcessing ? 0.7 : 1,
              transform: [{ scale: pressed ? 0.98 : 1 }],
            })}>
            <View
              style={{
                height: 40,
                width: '100%',
                borderRadius: 20,
                paddingHorizontal: 8,
                backgroundColor: colors.accent,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
              }}>
              {isProcessing ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  <MaterialCommunityIcons name="flash" size={15} color="#FFFFFF" />
                  <ThemedText
                    numberOfLines={1}
                    style={{
                      color: '#FFFFFF',
                      ...theme.typography.button,
                    }}>
                    Process
                  </ThemedText>
                </>
              )}
            </View>
          </Pressable>

          <Pressable
            onPress={onClear}
            disabled={isProcessing}
            style={({ pressed }) => ({
              flex: 1,
              flexBasis: 0,
              minWidth: 0,
              opacity: pressed ? 0.8 : 1,
              transform: [{ scale: pressed ? 0.98 : 1 }],
            })}>
            <View
              style={{
                height: 40,
                width: '100%',
                borderRadius: 20,
                paddingHorizontal: 8,
                backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F3F4F6',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <MaterialCommunityIcons name="close" size={15} color={isDark ? 'rgba(255,255,255,0.72)' : '#5E6C84'} />
              <ThemedText numberOfLines={1} style={{ ...theme.typography.button, color: isDark ? 'rgba(255,255,255,0.72)' : '#5E6C84' }}>
                Cancel
              </ThemedText>
            </View>
          </Pressable>
        </View>
      </View>
    );
  }

  // Initial / Recording State UI
  return (
    <View
      style={{
        marginHorizontal: 24,
        borderRadius: theme.radius.xxl,
        paddingHorizontal: theme.spacing.xxl,
        paddingTop: theme.spacing.xxl,
        paddingBottom: theme.spacing.xl,
        alignItems: 'center',
        gap: theme.spacing.lg,
        backgroundColor: isDark ? colors.card : colors.secondary,
      }}>
      <View style={{ gap: theme.spacing.xs, alignItems: 'center' }}>
        <ThemedText
          numberOfLines={1}
          variant="cardTitle"
          style={{
            textAlign: 'center',
            color: colors.text,
          }}>
          Tap and speak
        </ThemedText>
        <Animated.Text
          style={{
            opacity: promptFade,
            color: isDark ? 'rgba(255,255,255,0.58)' : 'rgba(45,45,45,0.56)',
            ...theme.typography.caption,
          }}>
          {samplePrompts[promptIndex]}
        </Animated.Text>
      </View>

      {/* Mic Button */}
      <Pressable
        onPress={onMicPress}
        style={{
          height: 100,
          width: 100,
          borderRadius: 50,
          alignItems: 'center',
          justifyContent: 'center',
          ...theme.shadows.accent,
        }}>
        <Animated.View
          pointerEvents="none"
          style={[
            styles.pulseRing,
            {
              backgroundColor: colors.accent,
              opacity: pulseOpacity,
              transform: [{ scale: pulseScale }],
            },
          ]}
        />
        <View
          style={{
            height: 100,
            width: 100,
            borderRadius: 50,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.accent,
            borderWidth: 8,
            borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.55)',
          }}>
          <MaterialCommunityIcons
            name={isRecording ? 'stop' : 'microphone'}
            size={34}
            color="#FFFFFF"
          />
        </View>
      </Pressable>

      {isRecording ? (
        <ThemedText
          variant="micro"
          style={{
            textAlign: 'center',
            textTransform: 'uppercase',
            letterSpacing: 1.2,
            color: colors.accent,
          }}>
          Listening...
        </ThemedText>
      ) : null}

      <TextAction
        label="I prefer to write"
        onPress={onToggleTextInput}
        disabled={isProcessing || isRecording}
        style={styles.writeToggle}>
        <MaterialCommunityIcons
          name={shouldShowTextInput ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={isDark ? 'rgba(255,255,255,0.54)' : 'rgba(45,45,45,0.46)'}
        />
      </TextAction>

      {shouldShowTextInput ? (
        <Animated.View
          style={{
            width: '100%',
            opacity: textEntryAnim,
            transform: [
              {
                translateY: textEntryAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-8, 0],
                }),
              },
            ],
          }}>
          <View
            style={{
              width: '100%',
              flexDirection: 'row',
              alignItems: 'flex-end',
              backgroundColor: isDark ? 'rgba(0,0,0,0.2)' : '#FFFFFF',
              borderRadius: theme.radius.lg,
              paddingLeft: 14,
              paddingRight: 8,
              paddingVertical: 7,
              shadowColor: '#000',
              shadowOpacity: 0.04,
              shadowRadius: 8,
              elevation: 1,
            }}>
            <MaterialCommunityIcons
              name="pencil"
              size={18}
              color={trimmedInput ? colors.accent : '#A0A0A0'}
              style={styles.inputIcon}
            />
            <TextInput
              ref={textInputRef}
              placeholder="spent 250 on food via UPI"
              placeholderTextColor="#A0A0A0"
              value={inputText}
              onChangeText={onChangeText}
              editable={!isProcessing && !isRecording}
              multiline
              returnKeyType="send"
              onSubmitEditing={() => {
                if (canSubmitText) {
                  onProcess();
                }
              }}
              style={{
                flex: 1,
                minHeight: 38,
                maxHeight: 82,
                fontSize: 14,
                fontFamily: theme.typography.body.fontFamily,
                color: colors.text,
                paddingTop: 9,
                paddingBottom: 9,
              }}
            />
            {trimmedInput ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Clear typed expense"
                onPress={onClear}
                disabled={isProcessing}
                style={styles.iconButton}>
                <MaterialCommunityIcons name="close-circle" size={20} color="#A0A0A0" />
              </Pressable>
            ) : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Parse typed expense"
              onPress={onProcess}
              disabled={!canSubmitText}
              style={[
                styles.sendButton,
                {
                  backgroundColor: canSubmitText ? colors.accent : '#E5E7EB',
                  opacity: isProcessing ? 0.7 : 1,
                },
              ]}>
              {isProcessing && trimmedInput ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <MaterialCommunityIcons
                  name="send"
                  size={17}
                  color={canSubmitText ? '#FFFFFF' : '#A0A0A0'}
                />
              )}
            </Pressable>
          </View>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  pulseRing: {
    position: 'absolute',
    height: 100,
    width: 100,
    borderRadius: 50,
  },
  writeToggle: {
    minHeight: 24,
    paddingHorizontal: 4,
    paddingVertical: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  inputIcon: {
    marginRight: 9,
    marginBottom: 10,
  },
  iconButton: {
    height: 38,
    width: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButton: {
    height: 38,
    width: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
