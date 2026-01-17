import { ThemedText } from '@/components/themed-text';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, TextInput, View } from 'react-native';

type VoiceInputCardProps = {
  onMicPress: () => void;
  isRecording: boolean;
  hasRecording: boolean;
  inputText: string;
  onChangeText: (text: string) => void;
  onProcess: () => void;
  onClear: () => void;
  isProcessing?: boolean;
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
}: VoiceInputCardProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];

  // Success State UI
  if (hasRecording && !isRecording) {
    return (
      <View
        style={{
          marginHorizontal: 24,
          borderRadius: 32,
          padding: 24,
          alignItems: 'center',
          gap: 24,
          backgroundColor: '#FCEDEB',
          shadowColor: '#000',
          shadowOpacity: 0.05,
          shadowRadius: 10,
          elevation: 2
        }}
      >
        {/* Animated Checkmark Circle */}
        <View style={{
          height: 80,
          width: 80,
          borderRadius: 40,
          backgroundColor: '#E8F5E9',
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 4,
          borderColor: '#C8E6C9',
          marginBottom: 8
        }}>
          <MaterialCommunityIcons name="check" size={40} color="#4CAF50" />
        </View>


        {/* Action Buttons */}
        <View style={{ width: '100%', gap: 12 }}>
          <Pressable
            onPress={onProcess}
            disabled={isProcessing}
            style={({ pressed }) => ({
              width: '100%',
              opacity: pressed ? 0.9 : (isProcessing ? 0.7 : 1),
              transform: [{ scale: pressed ? 0.98 : 1 }]
            })}
          >
            <View style={{
              width: '100%',
              height: 64,
              borderRadius: 32,
              backgroundColor: '#FFA06A',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              shadowColor: '#FFA06A',
              shadowOpacity: 0.3,
              shadowRadius: 10,
              shadowOffset: { width: 0, height: 6 },
              elevation: 4,
            }}>
              {isProcessing ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  <MaterialCommunityIcons name="flash" size={24} color="#FFFFFF" style={{ marginRight: 10 }} />
                  <ThemedText style={{ color: '#FFFFFF', fontWeight: 'bold', fontSize: 20, fontFamily: Fonts.title }}>
                    Let's Process This!
                  </ThemedText>
                </>
              )}
            </View>
          </Pressable>

          <Pressable
            onPress={onClear}
            disabled={isProcessing}
            style={({ pressed }) => ({
              width: '100%',
              opacity: pressed ? 0.8 : 1,
              transform: [{ scale: pressed ? 0.98 : 1 }]
            })}
          >
            <View style={{
              width: '100%',
              height: 60,
              borderRadius: 30,
              backgroundColor: '#F3F4F6',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <MaterialCommunityIcons name="refresh" size={22} color="#5E6C84" style={{ marginRight: 8 }} />
              <ThemedText style={{ color: '#5E6C84', fontWeight: 'bold', fontSize: 18, fontFamily: Fonts.title }}>
                Try Again
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
        borderRadius: 32,
        padding: 32,
        alignItems: 'center',
        gap: 24,
        backgroundColor: colorScheme === 'light' ? theme.secondary : theme.card
      }}
    >
      <View style={{ gap: 8, alignItems: 'center' }}>
        <ThemedText style={{ textAlign: 'center', fontSize: 18, fontWeight: '600', color: theme.text }}>
          Your personal finance assistant is ready!
        </ThemedText>
      </View>

      {/* Mic Button */}
      <Pressable
        onPress={onMicPress}
        style={{
          height: 128,
          width: 128,
          borderRadius: 64,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.accent,
          shadowColor: theme.accent,
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: 0.3,
          shadowRadius: 20,
          elevation: 10
        }}
      >
        <MaterialCommunityIcons name={isRecording ? "stop" : "microphone"} size={48} color="#FFFFFF" />
      </Pressable>

      <ThemedText style={{ textAlign: 'center', fontSize: 14, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 2, color: theme.accent }}>
        {isRecording ? "LISTENING..." : "TELL ME YOUR SPEND!"}
      </ThemedText>

      {/* Text Input Area (Initial) */}
      {/* <View
        style={{
          width: '100%',
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colorScheme === 'dark' ? 'rgba(0,0,0,0.2)' : '#FFFFFF',
          borderRadius: 999,
          paddingHorizontal: 16,
          paddingVertical: 4,
          shadowColor: '#000',
          shadowOpacity: 0.05,
          shadowRadius: 2,
          elevation: 1
        }}
      >
        <MaterialCommunityIcons name="pencil" size={20} color="#A0A0A0" />
        <TextInput
          placeholder="Or type a quick note..."
          placeholderTextColor="#A0A0A0"
          value={inputText}
          onChangeText={onChangeText}
          style={{
            flex: 1,
            marginLeft: 12,
            fontSize: 16,
            fontFamily: Fonts.body,
            color: theme.text
          }}
        />
        <Pressable onPress={onProcess}>
          <MaterialCommunityIcons name="send" size={20} color={inputText ? theme.accent : "#A0A0A0"} />
        </Pressable>
      </View> */}
    </View>
  );
}
