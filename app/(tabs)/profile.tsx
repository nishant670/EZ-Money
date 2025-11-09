import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

const spacing = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
};

const sections = [
  {
    id: 'account',
    title: 'Account',
    items: [
      {
        id: 'backup',
        title: 'Backup & Sync',
        subtitle: 'Last synced: Today at 10:45 AM',
        icon: 'cloud-upload-outline',
        toggle: true,
      },
      {
        id: 'security',
        title: 'Security',
        icon: 'lock-outline',
        chevron: true,
      },
      {
        id: 'export',
        title: 'Export Data',
        icon: 'download-outline',
        chevron: true,
      },
    ],
  },
  {
    id: 'preferences',
    title: 'Preferences',
    items: [
      {
        id: 'nudges',
        title: 'Nudges & Reminders',
        icon: 'bell-outline',
        chevron: true,
      },
    ],
  },
  {
    id: 'support',
    title: 'Support',
    items: [
      {
        id: 'about',
        title: 'About Finance Minister',
        icon: 'information-outline',
        chevron: true,
      },
      {
        id: 'help',
        title: 'Help & Support',
        icon: 'help-circle-outline',
        chevron: true,
      },
      {
        id: 'privacy',
        title: 'Privacy & Terms',
        icon: 'shield-outline',
        chevron: true,
      },
    ],
  },
];

export default function ProfileScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const [syncEnabled, setSyncEnabled] = useState(true);

  const surfaceColor = useMemo(
    () => (colorScheme === 'light' ? '#FFFFFF' : '#1E1E1E'),
    [colorScheme]
  );
  const borderColor = useMemo(
    () => (colorScheme === 'light' ? theme.border : '#2E2E2E'),
    [colorScheme, theme.border]
  );

  return (
    <ThemedView style={[styles.screen, { backgroundColor: theme.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Pressable accessibilityRole="button">
            <MaterialCommunityIcons
              name='arrow-left'
              size={22}
              color={theme.text}
            />
          </Pressable>
          <ThemedText style={styles.headerTitle}>Profile</ThemedText>
          <View style={{ width: 22 }} />
        </View>

        <View style={styles.profile}>
          <ThemedText type='title' style={styles.profileName}>
            Andi Rose
          </ThemedText>
          <ThemedText
            style={styles.profileEmail}
            lightColor='rgba(26,26,26,0.6)'
            darkColor='rgba(250,250,250,0.7)'>
            andi.rose@email.com
          </ThemedText>
        </View>

        <Pressable
          accessibilityRole='button'
          style={[
            styles.editButton,
            {
              backgroundColor:
                colorScheme === 'light'
                  ? 'rgba(217,217,217,0.4)'
                  : 'rgba(60,60,60,0.4)',
            },
          ]}>
          <ThemedText style={styles.editButtonText}>Edit Profile</ThemedText>
        </Pressable>

        {sections.map((section) => (
          <View key={section.id} style={styles.section}>
            <ThemedText
              style={styles.sectionLabel}
              lightColor='rgba(26,26,26,0.65)'
              darkColor='rgba(250,250,250,0.65)'>
              {section.title.toUpperCase()}
            </ThemedText>
            <View
              style={[
                styles.sectionCard,
                {
                  backgroundColor: surfaceColor,
                  borderColor,
                },
              ]}>
              {section.items.map((item, index) => (
                <View key={item.id}>
                  <View style={styles.row}>
                    <View
                      style={[
                        styles.rowIcon,
                        {
                          backgroundColor:
                            colorScheme === 'light'
                              ? 'rgba(83, 120, 107, 0.12)'
                              : 'rgba(163, 184, 162, 0.15)',
                        },
                      ]}>
                      <MaterialCommunityIcons
                        name={item.icon as keyof typeof MaterialCommunityIcons.glyphMap}
                        size={22}
                        color={theme.accent}
                      />
                    </View>
                    <View style={styles.rowContent}>
                      <ThemedText style={styles.rowTitle}>{item.title}</ThemedText>
                      {item.subtitle ? (
                        <ThemedText
                          style={styles.rowSubtitle}
                          lightColor='rgba(26,26,26,0.6)'
                          darkColor='rgba(250,250,250,0.7)'>
                          {item.subtitle}
                        </ThemedText>
                      ) : null}
                    </View>
                    {item.toggle ? (
                      <Switch
                        value={syncEnabled}
                        onValueChange={setSyncEnabled}
                        trackColor={{ false: 'rgba(26,26,26,0.2)', true: theme.accent }}
                        thumbColor='#FFFFFF'
                      />
                    ) : item.chevron ? (
                      <MaterialCommunityIcons
                        name='chevron-right'
                        size={22}
                        color='rgba(26,26,26,0.4)'
                      />
                    ) : null}
                  </View>
                  {index < section.items.length - 1 ? (
                    <View
                      style={[styles.divider, { backgroundColor: borderColor }]}
                    />
                  ) : null}
                </View>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          accessibilityRole='button'
          style={[
            styles.signOutButton,
            {
              backgroundColor: 'rgba(255, 99, 99, 0.15)',
              borderColor: 'rgba(255, 99, 99, 0.3)',
            },
          ]}>
          <MaterialCommunityIcons name='logout' size={20} color='#C0392B' />
          <ThemedText style={styles.signOutText} lightColor='#C0392B' darkColor='#FF6B6B'>
            Sign Out
          </ThemedText>
        </Pressable>
        <ThemedText
          style={styles.version}
          lightColor='rgba(26,26,26,0.4)'
          darkColor='rgba(250,250,250,0.4)'>
          App Version 1.0.0
        </ThemedText>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    justifyContent: 'space-between',
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: Fonts.title,
  },
  profile: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  profileName: {
    fontSize: 24,
  },
  profileEmail: {
    fontSize: 14,
    fontFamily: Fonts.body,
  },
  editButton: {
    borderRadius: 20,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  editButtonText: {
    fontSize: 16,
    fontFamily: Fonts.title,
  },
  section: {
    gap: spacing.sm,
  },
  sectionLabel: {
    fontSize: 12,
    letterSpacing: 1,
  },
  sectionCard: {
    borderRadius: 24,
    borderWidth: 1,
    padding: spacing.sm,
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  rowIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowContent: {
    flex: 1,
    gap: spacing.xs / 2,
  },
  rowTitle: {
    fontSize: 16,
    fontFamily: Fonts.title,
  },
  rowSubtitle: {
    fontSize: 13,
    fontFamily: Fonts.body,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: spacing.xs,
    marginHorizontal: spacing.sm,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg * 1.5,
    gap: spacing.sm,
  },
  signOutButton: {
    borderRadius: 20,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
    borderWidth: 1,
  },
  signOutText: {
    fontSize: 16,
    fontFamily: Fonts.title,
  },
  version: {
    textAlign: 'center',
    fontSize: 12,
    fontFamily: Fonts.body,
  },
});
