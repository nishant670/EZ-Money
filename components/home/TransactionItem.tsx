import { ThemedText } from '@/components/themed-text';
import { CURRENCY_SYMBOL } from '@/constants/Currency';
import { getMoodIconName } from '@/constants/theme';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

// Simplified props for UI matching
interface TransactionItemProps {
  icon: string;
  title: string;
  category: string;
  subtitle?: string;
  amount: string;
  date: string;
  color?: string;
  bgColor?: string;
  isIncome?: boolean;
  onPress?: () => void;
  variant?: 'card' | 'list';
  showDivider?: boolean;
}

export function TransactionItem({
  icon,
  title,
  category,
  subtitle,
  amount,
  date,
  color,
  bgColor,
  isIncome,
  onPress,
  variant = 'card',
  showDivider = false,
}: TransactionItemProps) {
  const theme = useThemeTokens();
  const isList = variant === 'list';
  const titleColor = theme.mode === 'dark' ? '#F3F4F6' : '#1F2933';
  const mutedColor = theme.mode === 'dark' ? 'rgba(255,255,255,0.5)' : '#9A9697';

  return (
    <View>
      <Pressable
        onPress={onPress}
        style={[
          styles.itemBase,
          isList ? styles.listItem : styles.cardItem,
          !isList ? { backgroundColor: theme.mode === 'dark' ? '#1F2937' : '#FFFFFF' } : undefined,
          !isList ? theme.shadows.soft : undefined,
        ]}>
        <View
          style={[
            isList ? styles.listIcon : styles.cardIcon,
            {
              backgroundColor: bgColor || (isIncome ? '#E8F5E9' : '#FFEBEE'),
              borderRadius: isList
                ? Math.min(theme.icon.containerRadius, 20)
                : theme.icon.containerRadius,
            },
          ]}>
          <MaterialCommunityIcons
            name={getMoodIconName(icon, theme.mood.iconStyle) as any}
            size={isList ? 20 : 24}
            color={color || (isIncome ? '#27AE60' : '#E57373')}
          />
        </View>

        <View style={styles.details}>
          <ThemedText
            numberOfLines={1}
            variant={isList ? 'bodyStrong' : 'sectionTitle'}
            style={[
              styles.title,
              {
                color: titleColor,
              },
            ]}>
            {title}
          </ThemedText>
          <View style={styles.metaRow}>
            <View
              style={[
                isList ? styles.listPill : styles.cardPill,
                { backgroundColor: bgColor || '#F3F4F6' },
              ]}>
              <ThemedText
                numberOfLines={1}
                variant="micro"
                style={[
                  styles.category,
                  {
                    color: color || '#6B7280',
                  },
                ]}>
                {category}
              </ThemedText>
            </View>
            {subtitle && (
              <ThemedText
                numberOfLines={1}
                variant="caption"
                style={[
                  styles.subtitle,
                  {
                    color: mutedColor,
                  },
                ]}>
                {isList ? subtitle : `• ${subtitle}`}
              </ThemedText>
            )}
          </View>
        </View>

        <View style={styles.amountBlock}>
          <ThemedText
            numberOfLines={1}
            variant="amount"
            style={[
              styles.amount,
              {
                color: isIncome ? '#27AE60' : theme.colors.text,
              },
            ]}>
            {isIncome ? '+' : '-'}
            {CURRENCY_SYMBOL}
            {amount}
          </ThemedText>
          {date ? (
            <ThemedText
              numberOfLines={1}
              variant="micro"
              style={[
                styles.date,
                {
                  color: mutedColor,
                },
              ]}>
              {date}
            </ThemedText>
          ) : null}
        </View>
      </Pressable>
      {showDivider ? <View style={styles.divider} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  itemBase: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardItem: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 24,
    marginBottom: 12,
  },
  listItem: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  cardIcon: {
    height: 48,
    width: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  listIcon: {
    height: 40,
    width: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  details: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  title: {},
  metaRow: {
    marginTop: 5,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
  },
  cardPill: {
    paddingHorizontal: 10,
    borderRadius: 12,
    marginRight: 8,
  },
  listPill: {
    paddingHorizontal: 8,
    paddingVertical: 1,
    borderRadius: 10,
    marginRight: 8,
    maxWidth: 118,
  },
  category: {
    textTransform: 'uppercase',
  },
  subtitle: {
    flex: 1,
  },
  amountBlock: {
    minWidth: 88,
    marginLeft: 10,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  amount: {},
  date: {
    marginTop: 5,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 66,
    backgroundColor: 'rgba(45,45,45,0.08)',
  },
});
