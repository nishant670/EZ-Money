import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/theme-primitives';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { formatCreditDate, type CreditSummary } from '@/lib/billing';

type CreditStatusCardProps = {
  credits: CreditSummary | null;
  loading?: boolean;
  compact?: boolean;
  onPress?: () => void;
};

export function CreditStatusCard({
  credits,
  loading = false,
  compact = false,
  onPress,
}: CreditStatusCardProps) {
  const theme = useThemeTokens();
  const colors = theme.colors;
  const dailyLimit = credits?.daily_limit ?? 0;
  const dailyRemaining = credits?.daily_credits_remaining ?? 0;
  const dailyUsed = credits?.daily_credits_used ?? 0;
  const progress = dailyLimit > 0 ? Math.min(1, Math.max(0, dailyUsed / dailyLimit)) : 0;
  const dailyRemainingRatio = dailyLimit > 0 ? dailyRemaining / dailyLimit : 1;
  const isLowDailyLimit = dailyLimit > 0 && dailyRemainingRatio < 0.2;
  const trialExpiry = formatCreditDate(credits?.trial_expires_at);
  const resetDate = formatCreditDate(credits?.reset_at);
  const compactContent = (
    <Card
      compact
      style={{
        padding: theme.spacing.md,
        gap: theme.spacing.sm,
      }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
        <View
          style={{
            height: 32,
            width: 32,
            borderRadius: 16,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: isLowDailyLimit ? '#FFF3E0' : colors.secondary,
          }}>
          <MaterialCommunityIcons
            name={isLowDailyLimit ? 'alert-circle-outline' : 'creation'}
            size={17}
            color={isLowDailyLimit ? '#EF6C00' : colors.accent}
          />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <ThemedText numberOfLines={1} variant="captionStrong" style={{ color: colors.text }}>
            {isLowDailyLimit ? 'Daily AI credits low' : 'AI credits'}
          </ThemedText>
          <ThemedText numberOfLines={1} variant="caption" style={{ color: `${colors.text}8F` }}>
            {loading ? 'Checking balance...' : `${dailyUsed}/${dailyLimit} used today`}
          </ThemedText>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <ThemedText variant="cardTitle" style={{ color: colors.text, fontSize: 18 }}>
            {credits?.daily_credits_remaining ?? '—'}
          </ThemedText>
          <ThemedText variant="micro" style={{ color: `${colors.text}8F` }}>
            left today
          </ThemedText>
        </View>
      </View>

      <View
        style={{
          height: 5,
          borderRadius: 3,
          overflow: 'hidden',
          backgroundColor: theme.mode === 'dark' ? 'rgba(255,255,255,0.08)' : '#F1E6E8',
        }}>
        <View
          style={{
            height: '100%',
            width: `${progress * 100}%`,
            borderRadius: 3,
            backgroundColor: isLowDailyLimit ? '#EF6C00' : colors.accent,
          }}
        />
      </View>

      <ThemedText numberOfLines={1} variant="micro" style={{ color: `${colors.text}7A` }}>
        {credits?.total_credits_remaining ?? '—'} total credits left
      </ThemedText>
    </Card>
  );

  const content = compact ? compactContent : (
    <Card
      compact
      style={{
        padding: theme.spacing.lg,
        gap: theme.spacing.md,
      }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
        <View
          style={{
            height: 38,
            width: 38,
            borderRadius: 19,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.secondary,
          }}>
          <MaterialCommunityIcons name="creation" size={19} color={colors.accent} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <ThemedText variant="captionStrong" style={{ color: colors.text }}>
            Finnri AI credits
          </ThemedText>
          <ThemedText numberOfLines={1} variant="caption" style={{ color: `${colors.text}8F` }}>
            {loading
              ? 'Checking balance...'
              : trialExpiry
                ? `Trial expires ${trialExpiry}`
                : resetDate
                  ? `Daily limit resets ${resetDate}`
                  : 'Usage refreshes daily'}
          </ThemedText>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <ThemedText
            variant="cardTitle"
            style={{ color: colors.text, fontSize: compact ? 18 : 22 }}>
            {credits?.total_credits_remaining ?? '—'}
          </ThemedText>
          <ThemedText variant="micro" style={{ color: `${colors.text}8F` }}>
            left
          </ThemedText>
        </View>
      </View>

      <View style={{ gap: 8 }}>
        <View
          style={{
            height: 8,
            borderRadius: 4,
            overflow: 'hidden',
            backgroundColor: theme.mode === 'dark' ? 'rgba(255,255,255,0.08)' : '#F1E6E8',
          }}>
          <View
            style={{
              height: '100%',
              width: `${progress * 100}%`,
              borderRadius: 4,
              backgroundColor: colors.accent,
            }}
          />
        </View>
        <View
          style={{ flexDirection: 'row', justifyContent: 'space-between', gap: theme.spacing.sm }}>
          <ThemedText variant="caption" style={{ color: `${colors.text}99` }}>
            {dailyRemaining} daily left
          </ThemedText>
          <ThemedText variant="caption" style={{ color: `${colors.text}99` }}>
            {dailyUsed}/{dailyLimit} used today
          </ThemedText>
        </View>
      </View>
    </Card>
  );

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => ({
          opacity: pressed ? 0.86 : 1,
          marginHorizontal: compact ? 0 : 24,
        })}>
        {content}
      </Pressable>
    );
  }

  return <View style={{ marginHorizontal: compact ? 0 : 24 }}>{content}</View>;
}
