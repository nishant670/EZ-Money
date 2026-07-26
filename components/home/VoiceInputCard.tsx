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
  const micSizeAnim = useRef(new Animated.Value(shouldShowTextInput ? 0 : 1)).current;
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

    Animated.timing(micSizeAnim, {
      toValue: shouldShowTextInput ? 0 : 1,
      duration: 240,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();

    if (shouldShowTextInput) {
      const focusTimeout = setTimeout(() => textInputRef.current?.focus(), 160);
      return () => clearTimeout(focusTimeout);
    }

    return undefined;
  }, [micSizeAnim, shouldShowTextInput, textEntryAnim]);

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
  const micSize = micSizeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [78, 124],
  });
  const micRadius = micSizeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [39, 62],
  });
  const micBorderWidth = micSizeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [6, 9],
  });
  const micIconScale = micSizeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.8, 1.16],
  });
  const cardGap = shouldShowTextInput || isRecording ? theme.spacing.md : theme.spacing.lg;

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
          minHeight: 282,
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
        </View>

        <View
          style={{
            alignSelf: 'stretch',
            flexDirection: 'row',
            flexWrap: 'wrap',
            columnGap: theme.spacing.sm,
            rowGap: theme.spacing.sm,
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
          }}>
          <Pressable
            onPress={onProcess}
            disabled={isProcessing}
            style={({ pressed }) => ({
              flexGrow: 1,
              flexShrink: 1,
              flexBasis: 132,
              minWidth: 0,
              opacity: pressed ? 0.9 : isProcessing ? 0.7 : 1,
              transform: [{ scale: pressed ? 0.98 : 1 }],
            })}>
            <View
              style={{
                height: 38,
                width: '100%',
                borderRadius: 19,
                paddingHorizontal: 6,
                backgroundColor: colors.accent,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 3,
              }}>
              {isProcessing ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  <MaterialCommunityIcons name="flash" size={14} color="#FFFFFF" />
                  <ThemedText
                    numberOfLines={1}
                    style={{
                      color: '#FFFFFF',
                      fontSize: 12,
                      lineHeight: 14,
                      fontFamily: theme.typography.button.fontFamily,
                      fontWeight: theme.typography.button.fontWeight,
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
              flexGrow: 1,
              flexShrink: 1,
              flexBasis: 132,
              minWidth: 0,
              opacity: pressed ? 0.8 : 1,
              transform: [{ scale: pressed ? 0.98 : 1 }],
            })}>
            <View
              style={{
                height: 38,
                width: '100%',
                borderRadius: 19,
                paddingHorizontal: 6,
                backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F3F4F6',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 3,
              }}>
              <MaterialCommunityIcons
                name="close"
                size={14}
                color={isDark ? 'rgba(255,255,255,0.72)' : '#5E6C84'}
              />
              <ThemedText
                numberOfLines={1}
                style={{
                  color: isDark ? 'rgba(255,255,255,0.72)' : '#5E6C84',
                  fontSize: 12,
                  lineHeight: 14,
                  fontFamily: theme.typography.button.fontFamily,
                  fontWeight: theme.typography.button.fontWeight,
                }}>
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
        minHeight: 286,
        alignItems: 'center',
        gap: cardGap,
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
      <Animated.View
        style={[
          {
            height: micSize,
            width: micSize,
            borderRadius: micRadius,
            alignItems: 'center',
            justifyContent: 'center',
          },
          theme.shadows.accent,
        ]}>
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
        <Pressable
          onPress={onMicPress}
          style={{
            height: '100%',
            width: '100%',
            borderRadius: 999,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Animated.View
            style={{
              alignSelf: 'stretch',
              flex: 1,
              borderRadius: 999,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.accent,
              borderWidth: micBorderWidth,
              borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.55)',
            }}>
            <Animated.View style={{ transform: [{ scale: micIconScale }] }}>
              <MaterialCommunityIcons
                name={isRecording ? 'stop' : 'microphone'}
                size={38}
                color="#FFFFFF"
              />
            </Animated.View>
          </Animated.View>
        </Pressable>
      </Animated.View>

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
        label="I Prefer To Write"
        onPress={onToggleTextInput}
        disabled={isProcessing || isRecording}
        style={styles.writeToggle}
      />

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
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: 999,
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
