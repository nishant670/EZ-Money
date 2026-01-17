import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { cssInterop } from 'nativewind';
import { useState } from 'react';
import { Pressable, ScrollView, Switch, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

const TView = cssInterop(ThemedView, { className: 'style' });
const TText = cssInterop(ThemedText, { className: 'style' });

type AccountTypeOption = {
  key: 'credit' | 'bank' | 'wallet' | 'upi';
  label: string;
  description: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
};

const typeOptions: AccountTypeOption[] = [
  { key: 'credit', label: 'Credit Card', description: 'Card limits & spends', icon: 'credit-card-outline' },
  { key: 'bank', label: 'Bank Account', description: 'Primary salary or savings', icon: 'bank-outline' },
  { key: 'wallet', label: 'Wallet', description: 'Paytm, Amazon Pay, etc.', icon: 'wallet-outline' },
  { key: 'upi', label: 'UPI', description: 'Handles like name@bank', icon: 'cellphone-nfc' },
];

export default function ManageAccountScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const [isDefault, setIsDefault] = useState(false);
  const [form, setForm] = useState({
    type: 'credit' as AccountTypeOption['key'],
    name: '',
    provider: '',
    identifier: '',
  });

  return (
    <SafeAreaView className="flex-1" edges={['bottom']}>
      <TView className="flex-1" style={{ backgroundColor: theme.background }}>
        <ScrollView contentContainerStyle={{ padding: 24, gap: 20 }}>
          <View className="flex-row items-center justify-between">
            <Pressable accessibilityRole="button" onPress={() => router.back()}>
              <MaterialCommunityIcons name="close" size={22} color={theme.text} />
            </Pressable>
            <TText className="text-lg" style={{ fontFamily: Fonts.title }}>
              Add Account
            </TText>
            <View style={{ width: 22 }} />
          </View>

          <View className="gap-1">
            <TText className="text-2xl" style={{ fontFamily: Fonts.title }}>
              Where does this sit?
            </TText>
            <TText className="text-sm text-black/60 dark:text-white/60" style={{ fontFamily: Fonts.body }}>
              Categorize the account so we can show insights tailor-made for you.
            </TText>
          </View>

          <View className="gap-3">
            {typeOptions.map((option) => {
              const isActive = form.type === option.key;
              return (
                <Pressable
                  key={option.key}
                  accessibilityRole="button"
                  onPress={() => setForm((prev) => ({ ...prev, type: option.key }))}
                  className="flex-row items-center gap-4 rounded-3xl border px-4 py-4"
                  style={{
                    borderColor: isActive ? theme.accent : 'rgba(120,120,120,0.3)',
                    backgroundColor: isActive
                      ? colorScheme === 'light'
                        ? 'rgba(137,207,151,0.15)'
                        : 'rgba(137,207,151,0.08)'
                      : 'transparent',
                  }}
                >
                  <View
                    className="h-11 w-11 items-center justify-center rounded-full"
                    style={{ backgroundColor: colorScheme === 'light' ? '#F3F4F6' : '#2C2C2C' }}
                  >
                    <MaterialCommunityIcons name={option.icon} size={20} color={theme.text} />
                  </View>
                  <View className="flex-1">
                    <TText className="text-base" style={{ fontFamily: Fonts.title }}>
                      {option.label}
                    </TText>
                    <TText className="text-sm text-black/60 dark:text-white/60" style={{ fontFamily: Fonts.body }}>
                      {option.description}
                    </TText>
                  </View>
                  {isActive && <MaterialCommunityIcons name="check-circle" size={22} color={theme.accent} />}
                </Pressable>
              );
            })}
          </View>

          <View className="gap-3">
            <Field label="Name">
              <TextInput
                value={form.name}
                onChangeText={(text) => setForm((prev) => ({ ...prev, name: text }))}
                placeholder="Personal HDFC Credit Card"
                placeholderTextColor={colorScheme === 'light' ? 'rgba(26,26,26,0.4)' : 'rgba(250,250,250,0.4)'}
                className="text-base"
                style={{ fontFamily: Fonts.body, color: theme.text }}
              />
            </Field>
            <Field label="Provider">
              <TextInput
                value={form.provider}
                onChangeText={(text) => setForm((prev) => ({ ...prev, provider: text }))}
                placeholder="HDFC Bank"
                placeholderTextColor={colorScheme === 'light' ? 'rgba(26,26,26,0.4)' : 'rgba(250,250,250,0.4)'}
                className="text-base"
                style={{ fontFamily: Fonts.body, color: theme.text }}
              />
            </Field>
            <Field label="Identifier">
              <TextInput
                value={form.identifier}
                onChangeText={(text) => setForm((prev) => ({ ...prev, identifier: text }))}
                placeholder="**** 1234 or nishant@oksbi"
                placeholderTextColor={colorScheme === 'light' ? 'rgba(26,26,26,0.4)' : 'rgba(250,250,250,0.4)'}
                className="text-base"
                style={{ fontFamily: Fonts.body, color: theme.text }}
              />
            </Field>
          </View>

          <View
            className="flex-row items-center justify-between rounded-3xl border px-4 py-3"
            style={{ borderColor: 'rgba(120,120,120,0.3)' }}
          >
            <View className="flex-1 pr-4">
              <TText className="text-base" style={{ fontFamily: Fonts.title }}>
                Set as default account
              </TText>
              <TText className="text-sm text-black/60 dark:text-white/60" style={{ fontFamily: Fonts.body }}>
                New entries will auto-select this source.
              </TText>
            </View>
            <Switch
              value={isDefault}
              onValueChange={setIsDefault}
              thumbColor={isDefault ? theme.accent : undefined}
              trackColor={{ true: colorScheme === 'light' ? 'rgba(137,207,151,0.4)' : 'rgba(137,207,151,0.3)', false: 'rgba(120,120,120,0.3)' }}
            />
          </View>

          <View className="flex-row gap-3 pt-4">
            <Pressable
              accessibilityRole="button"
              onPress={() => router.back()}
              className="flex-1 items-center justify-center rounded-3xl border py-3"
              style={{ borderColor: 'rgba(120,120,120,0.4)' }}
            >
              <TText className="text-base" style={{ fontFamily: Fonts.title }}>
                Cancel
              </TText>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.back()}
              className="flex-1 items-center justify-center rounded-3xl py-3"
              style={{ backgroundColor: theme.accent }}
            >
              <TText className="text-base text-white" style={{ fontFamily: Fonts.title }}>
                Save
              </TText>
            </Pressable>
          </View>
        </ScrollView>
      </TView>
    </SafeAreaView>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View className="gap-2">
      <TText className="text-sm text-black/65 dark:text-white/65" style={{ fontFamily: Fonts.body }}>
        {label}
      </TText>
      <View className="rounded-3xl border px-4 py-3" style={{ borderColor: 'rgba(120,120,120,0.3)' }}>
        {children}
      </View>
    </View>
  );
}
