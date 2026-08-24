import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Contacts from 'expo-contacts/legacy';
import { cssInterop } from 'nativewind';
import { ActivityIndicator, Image, Pressable, ScrollView, TextInput, View } from 'react-native';

import { AppHeader } from '@/components/navigation/AppHeader';
import { contactMatchesFriend } from '@/components/split/split-utils';
import type { DeviceContactOption, SplitGroupSummary } from '@/components/split/split-types';
import { SplitFullScreenModal } from '@/components/split/primitives/SplitFullScreenModal';
import { ThemedText } from '@/components/themed-text';
import { SkeletonFrame, SkeletonRows } from '@/components/ui/Skeleton';
import { Fonts } from '@/constants/theme';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import type { SplitFriend } from '@/lib/splits';

const TText = cssInterop(ThemedText, { className: 'style' });

export function GroupMembersModal({
  summary,
  friends,
  contacts,
  contactsPermissionStatus,
  contactsAccessPrivileges,
  contactsLoading,
  searchQuery,
  selectedFriendIds,
  saving,
  onChangeSearchQuery,
  onToggleFriend,
  onSelectContact,
  onRequestContactsAccess,
  onCreateFriend,
  onClose,
  onSave,
}: {
  summary: SplitGroupSummary | null;
  friends: SplitFriend[];
  contacts: DeviceContactOption[];
  contactsPermissionStatus: Contacts.PermissionStatus | null;
  contactsAccessPrivileges: Contacts.ContactsPermissionResponse['accessPrivileges'] | null;
  contactsLoading: boolean;
  searchQuery: string;
  selectedFriendIds: number[];
  saving: boolean;
  onChangeSearchQuery: (value: string) => void;
  onToggleFriend: (friendId: number) => void;
  onSelectContact: (contact: DeviceContactOption) => void;
  onRequestContactsAccess: () => void;
  onCreateFriend: () => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const theme = useThemeTokens().colors;
  if (!summary) return null;

  const normalizedSearch = searchQuery.trim().toLowerCase();
  const contactAccessGranted = contactsPermissionStatus === Contacts.PermissionStatus.GRANTED;
  const filteredContacts = contacts.filter((contact) =>
    [contact.name, contact.phone, contact.email]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(normalizedSearch)
  );
  const filteredFriends = friends.filter((friend) =>
    [friend.name, friend.phone, friend.email]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(normalizedSearch)
  );

  return (
    <SplitFullScreenModal onClose={onClose}>
      {(close) => (
        <>
          <AppHeader
            title="Group members"
            subtitle={summary.group.name}
            onBack={close}
            rightNode={
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Save group members"
                disabled={saving}
                onPress={onSave}
                className="ml-4 min-h-10 min-w-12 items-center justify-center rounded-full px-3"
                style={{ backgroundColor: theme.card }}>
                {saving ? (
                  <ActivityIndicator color={theme.accent} />
                ) : (
                  <TText variant="button" style={{ color: theme.accent }}>
                    Save
                  </TText>
                )}
              </Pressable>
            }
          />
          <View
            className="mx-6 mb-3 flex-row items-center rounded-2xl px-4"
            style={{ backgroundColor: theme.card }}>
            <MaterialCommunityIcons name="magnify" size={21} color={theme.accent} />
            <TextInput
              value={searchQuery}
              onChangeText={onChangeSearchQuery}
              autoFocus
              autoCapitalize="none"
              placeholder="Enter name, email, or phone #"
              placeholderTextColor={theme.mutedStrong}
              style={{
                flex: 1,
                minHeight: 48,
                marginLeft: 10,
                color: theme.text,
                fontFamily: Fonts.body,
                fontSize: 16,
              }}
            />
          </View>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 44 }}>
            <Pressable
              accessibilityRole="button"
              onPress={onCreateFriend}
              className="min-h-16 flex-row items-center gap-8 py-2">
              <View className="w-12 items-center">
                <MaterialCommunityIcons name="account-plus-outline" size={28} color={theme.text} />
              </View>
              <TText
                className="flex-1 text-xl"
                style={{ color: theme.text, fontFamily: Fonts.body }}>
                {searchQuery.trim()
                  ? `Add "${searchQuery.trim()}" as new friend`
                  : 'Add someone new'}
              </TText>
            </Pressable>

            <TText
              className="mt-5 text-base"
              style={{ color: theme.mutedStrong, fontFamily: Fonts.title }}>
              From your contacts
            </TText>

            {!contactAccessGranted ? (
              <ContactsPermissionPrompt
                loading={contactsLoading}
                denied={contactsPermissionStatus === Contacts.PermissionStatus.DENIED}
                onRequest={onRequestContactsAccess}
              />
            ) : contactsLoading ? (
              <SkeletonFrame label="Loading contacts" testID="contacts-skeleton">
                <SkeletonRows count={5} variant="list" showAmount={false} carded={false} />
              </SkeletonFrame>
            ) : filteredContacts.length > 0 ? (
              <View className="mt-3">
                {contactsAccessPrivileges === 'limited' ? (
                  <TText className="mb-2 text-xs" style={{ color: theme.muted }}>
                    Showing contacts you allowed Finnri to access.
                  </TText>
                ) : null}
                {filteredContacts.map((contact) => {
                  const matchedFriend = friends.find((friend) =>
                    contactMatchesFriend(contact, friend)
                  );
                  const selected = Boolean(
                    matchedFriend && selectedFriendIds.includes(matchedFriend.id)
                  );
                  return (
                    <MemberDirectoryRow
                      key={contact.id}
                      title={contact.name}
                      subtitle={[contact.phone, contact.email].filter(Boolean).join(', ')}
                      imageUri={contact.imageUri}
                      selected={selected}
                      onPress={() => onSelectContact(contact)}
                    />
                  );
                })}
              </View>
            ) : (
              <TText className="mt-6 text-sm" style={{ color: theme.muted }}>
                {normalizedSearch ? 'No matching contacts.' : 'No contacts available.'}
              </TText>
            )}

            <TText
              className="mt-8 text-base"
              style={{ color: theme.mutedStrong, fontFamily: Fonts.title }}>
              Friends on Finnri
            </TText>
            {filteredFriends.length > 0 ? (
              <View className="mt-3">
                {filteredFriends.map((friend) => (
                  <MemberDirectoryRow
                    key={friend.id}
                    title={friend.name}
                    subtitle={[friend.phone, friend.email].filter(Boolean).join(', ')}
                    selected={selectedFriendIds.includes(friend.id)}
                    onPress={() => onToggleFriend(friend.id)}
                  />
                ))}
              </View>
            ) : (
              <TText className="mt-6 text-sm" style={{ color: theme.muted }}>
                {normalizedSearch ? 'No matching Finnri friends.' : 'No Finnri friends yet.'}
              </TText>
            )}
          </ScrollView>
        </>
      )}
    </SplitFullScreenModal>
  );
}

function ContactsPermissionPrompt({
  loading,
  denied,
  onRequest,
}: {
  loading: boolean;
  denied: boolean;
  onRequest: () => void;
}) {
  const theme = useThemeTokens().colors;
  return (
    <View className="items-center px-4 py-12">
      <View
        className="h-36 w-36 items-center justify-center rounded-full"
        style={{ backgroundColor: theme.secondary }}>
        <MaterialCommunityIcons name="contacts-outline" size={72} color={theme.accent} />
      </View>
      <TText className="mt-8 text-center text-lg leading-7" style={{ color: theme.muted }}>
        Allow Finnri to access your contacts to add people faster.
      </TText>
      <Pressable
        accessibilityRole="button"
        disabled={loading}
        onPress={onRequest}
        className="mt-8 min-h-12 min-w-[230px] items-center justify-center rounded"
        style={{ backgroundColor: theme.accent, opacity: loading ? 0.75 : 1 }}>
        {loading ? (
          <ActivityIndicator color={theme.onAccent} />
        ) : (
          <TText variant="button" style={{ color: theme.onAccent }}>
            {denied ? 'Request contact access' : 'Allow contact access'}
          </TText>
        )}
      </Pressable>
    </View>
  );
}

function MemberDirectoryRow({
  title,
  subtitle,
  imageUri,
  selected,
  onPress,
}: {
  title: string;
  subtitle?: string;
  imageUri?: string;
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useThemeTokens().colors;
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      className="min-h-[76px] flex-row items-center gap-8 py-2">
      <View className="w-12 items-center">
        {imageUri ? (
          <Image source={{ uri: imageUri }} className="h-12 w-12 rounded-full" />
        ) : (
          <View
            className="h-12 w-12 items-center justify-center rounded-full"
            style={{ backgroundColor: selected ? theme.accent : theme.secondary }}>
            <MaterialCommunityIcons
              name={subtitle ? 'phone-outline' : 'account-outline'}
              size={22}
              color={selected ? theme.onAccent : theme.text}
            />
          </View>
        )}
      </View>
      <View className="flex-1">
        <TText
          className="text-xl"
          numberOfLines={1}
          style={{ color: theme.text, fontFamily: Fonts.body }}>
          {title}
        </TText>
        {subtitle ? (
          <TText className="mt-1 text-sm" style={{ color: theme.muted }} numberOfLines={1}>
            {subtitle}
          </TText>
        ) : null}
      </View>
      {selected ? (
        <MaterialCommunityIcons name="check-circle" size={22} color={theme.accent} />
      ) : null}
    </Pressable>
  );
}
