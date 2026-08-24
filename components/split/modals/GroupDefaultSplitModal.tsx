import { cssInterop } from 'nativewind';
import { Modal, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  AdjustSplitScreen,
  SplitChoiceScreen,
} from '@/components/split/expense/AddExpenseModal';
import { ThemedText } from '@/components/themed-text';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { Fonts } from '@/constants/theme';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import {
  buildSeedWeights,
  type SplitSelection,
  type SplitSlotPerson,
} from '@/lib/split-preferences';

const TText = cssInterop(ThemedText, { className: 'style' });

/**
 * The group's default split, edited on the same two screens the expense
 * composer uses. There is no amount yet, so the rupee previews stand down and
 * the exact-amounts tab is withheld — a default has to be a ratio to survive
 * until the next expense.
 *
 * The people here are the group's real roster, owner first, with "you" landing
 * on whichever slot belongs to the viewer. The stored default names the same
 * people for every member, so it has to be edited in those terms rather than in
 * one member's private frame.
 */
export function GroupDefaultSplitModal({
  groupName,
  people,
  draft,
  screen,
  saving,
  errorMessage,
  hasSavedDefault,
  onChangeDraft,
  onChangeScreen,
  onSave,
  onReset,
  onClose,
}: {
  groupName: string;
  people: SplitSlotPerson[];
  draft: SplitSelection;
  screen: 'choice' | 'adjust';
  saving: boolean;
  errorMessage?: string | null;
  hasSavedDefault: boolean;
  onChangeDraft: (next: SplitSelection) => void;
  onChangeScreen: (screen: 'choice' | 'adjust') => void;
  onSave: () => void;
  onReset: () => void;
  onClose: () => void;
}) {
  const theme = useThemeTokens().colors;

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <SafeAreaView
        className="flex-1"
        edges={['top', 'left', 'right']}
        style={{ backgroundColor: theme.background }}>
        {screen === 'choice' ? (
          <View className="flex-1">
            <SplitChoiceScreen
              people={people}
              selection={draft}
              title={`Default split for ${groupName}`}
              onBack={onClose}
              onDone={onSave}
              onSelectPayer={(payerKey, fullAmount) =>
                onChangeDraft({ ...draft, payerKey, fullAmount, tab: 'equally', weights: {} })
              }
              onMoreOptions={() => onChangeScreen('adjust')}
            />
            {errorMessage ? (
              <ErrorBanner message={errorMessage} style={{ marginHorizontal: 24, marginTop: 8 }} />
            ) : null}
            {hasSavedDefault ? (
              <Pressable
                accessibilityRole="button"
                disabled={saving}
                onPress={onReset}
                className="mb-6 min-h-12 items-center justify-center self-center px-6">
                <TText className="text-base" style={{ color: theme.negative, fontFamily: Fonts.title }}>
                  Remove default split
                </TText>
              </Pressable>
            ) : null}
          </View>
        ) : (
          <AdjustSplitScreen
            people={people}
            selection={draft}
            /* A ratio needs some amount to divide; 100 keeps the maths honest
             * while `variant="default"` keeps the rupee figures off screen. */
            amount={100}
            variant="default"
            title="Default split"
            errorMessage={errorMessage}
            onBack={() => onChangeScreen('choice')}
            onDone={onSave}
            onSelectPayer={(payerKey, fullAmount) =>
              onChangeDraft({ ...draft, payerKey, fullAmount })
            }
            onToggleParticipant={(key) =>
              onChangeDraft({
                ...draft,
                participantKeys: draft.participantKeys.includes(key)
                  ? draft.participantKeys.filter((currentKey) => currentKey !== key)
                  : [...draft.participantKeys, key],
              })
            }
            onToggleAll={() => {
              const allKeys = people.map((person) => person.key);
              const allSelected = allKeys.every((key) => draft.participantKeys.includes(key));
              onChangeDraft({ ...draft, participantKeys: allSelected ? [] : allKeys });
            }}
            onChangeTab={(tab) =>
              onChangeDraft({
                ...draft,
                tab,
                weights:
                  Object.keys(draft.weights).length > 0
                    ? draft.weights
                    : buildSeedWeights(tab, { ...draft, tab }),
              })
            }
            onChangeWeight={(key, value) =>
              onChangeDraft({ ...draft, weights: { ...draft.weights, [key]: value } })
            }
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}
