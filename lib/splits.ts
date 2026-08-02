import { ApiFieldErrors, readApiError } from './api-error';
import { API_BASE_URL } from './transactions';

export type SplitDirection = 'friend_owes_user' | 'user_owes_friend';
export type SettlementDirection = 'friend_paid_user' | 'user_paid_friend';

export type SplitFriend = {
  id: number;
  user_id: number;
  name: string;
  email?: string;
  phone?: string;
  archived: boolean;
  created_at?: string;
  updated_at?: string;
};

export type SplitParticipant = {
  id?: number;
  user_id?: number;
  bill_id?: number;
  friend_id: number;
  friend?: SplitFriend;
  share_amount: number;
  direction: SplitDirection;
};

export type SplitGroupMember = {
  id: number;
  user_id: number;
  group_id: number;
  friend_id: number;
  friend?: SplitFriend;
};

export type SplitGroup = {
  id: number;
  user_id: number;
  name: string;
  archived: boolean;
  members?: SplitGroupMember[];
  viewer_role?: 'owner' | 'member';
  viewer_can_add_expense?: boolean;
  viewer_can_manage?: boolean;
  created_at?: string;
  updated_at?: string;
};

export type SplitGroupInvite = {
  token: string;
  url: string;
  deep_link: string;
  group: SplitGroup;
  expires_at?: string | null;
};

export type SplitGroupDirectInvite = {
  id: number;
  target_email: string;
  target_phone: string;
  matched_user: boolean;
  notification_sent: boolean;
  url: string;
  deep_link: string;
  message: string;
  status: string;
  group: SplitGroup;
  created_at?: string;
};

export type SplitGroupInviteDetails = {
  token: string;
  group: SplitGroup;
  owner_name: string;
  member_count: number;
  status: string;
  expires_at?: string | null;
};

export type SplitGroupInviteAcceptResponse = {
  group: SplitGroup;
  friend: SplitFriend;
  member: SplitGroupMember;
};

export type SplitBill = {
  id: number;
  user_id: number;
  entry_id?: number | null;
  group_id?: number | null;
  group?: SplitGroup | null;
  title: string;
  total_amount: number;
  currency: 'INR';
  date: string;
  notes?: string;
  participants: SplitParticipant[];
  viewer_can_edit?: boolean;
  viewer_can_delete?: boolean;
  created_at?: string;
  updated_at?: string;
};

export type SplitSettlement = {
  id: number;
  user_id: number;
  friend_id: number;
  friend?: SplitFriend;
  amount: number;
  direction: SettlementDirection;
  date: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
};

export type SplitBalance = {
  friend: SplitFriend;
  total_owed_by_friend: number;
  total_owed_to_friend: number;
  net_balance: number;
};

export type SplitActivityType = 'group_created' | 'friend_created' | 'bill' | 'settlement';

export type SplitActivityItem = {
  id: string;
  type: SplitActivityType;
  record_id: number;
  title: string;
  date: string;
  amount?: number;
  group_id?: number | null;
  group?: SplitGroup | null;
  friend_id?: number | null;
  friend?: SplitFriend | null;
  direction?: SettlementDirection;
  participant_count?: number;
  participants?: SplitParticipant[];
  notes?: string;
  created_at: string;
};

export type SplitActivityResponse = {
  items: SplitActivityItem[];
  page: number;
  page_size: number;
  total: number;
};

export type SplitFriendPayload = {
  name: string;
  email?: string;
  phone?: string;
};

export type SplitBillPayload = {
  entry_id?: number | null;
  group_id?: number | null;
  title: string;
  total_amount: number;
  currency?: 'INR';
  date: string;
  notes?: string;
  participants: Array<{
    friend_id: number;
    share_amount: number;
    direction: SplitDirection;
  }>;
};

export type SplitGroupPayload = {
  name: string;
  friend_ids: number[];
};

export type SplitSettlementPayload = {
  friend_id: number;
  amount: number;
  direction: SettlementDirection;
  date: string;
  notes?: string;
};

export class SplitApiError extends Error {
  status: number;
  code?: string;
  fields?: ApiFieldErrors;

  constructor(message: string, status: number, code?: string, fields?: ApiFieldErrors) {
    super(message);
    this.name = 'SplitApiError';
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

const splitFieldLabels: Record<string, string> = {
  name: 'Friend name',
  email: 'Email',
  phone: 'Phone',
  title: 'Bill title',
  total_amount: 'Total amount',
  date: 'Date',
  participants: 'Friend shares',
  entry_id: 'Transaction',
  friend_id: 'Friend',
  group_id: 'Group',
  group_name: 'Group',
  friend_ids: 'Group friends',
  share_amount: 'Share amount',
  amount: 'Settlement amount',
  direction: 'Direction',
};

const readSplitError = async (response: Response, fallback: string): Promise<SplitApiError> => {
  const apiError = await readApiError(response, fallback, splitFieldLabels);
  return new SplitApiError(apiError.message, apiError.status, apiError.code, apiError.fields);
};

const authHeaders = (token: string, json = false) => ({
  ...(json ? { 'Content-Type': 'application/json' } : {}),
  Authorization: `Bearer ${token}`,
});

const coerceAmount = (record: Record<string, unknown>, keys: string[]) => {
  const next = { ...record };
  for (const key of keys) {
    if (next[key] != null) {
      next[key] = Number(next[key]);
    }
  }
  return next;
};

const normalizeSplitBill = (bill: SplitBill): SplitBill => ({
  ...bill,
  total_amount: Number(bill.total_amount),
  participants: (bill.participants ?? []).map((participant) =>
    coerceAmount(participant as unknown as Record<string, unknown>, ['share_amount'])
  ) as SplitParticipant[],
});

export const fetchSplitFriends = async (token: string): Promise<SplitFriend[]> => {
  const response = await fetch(`${API_BASE_URL}/v1/split/friends`, {
    headers: authHeaders(token),
  });
  if (!response.ok) {
    throw await readSplitError(response, 'Unable to load split friends right now.');
  }
  const payload: unknown = await response.json();
  if (!Array.isArray(payload)) {
    throw new Error('The split friends response was invalid.');
  }
  return payload as SplitFriend[];
};

export const createSplitFriend = async (
  token: string,
  payload: SplitFriendPayload
): Promise<SplitFriend> => {
  const response = await fetch(`${API_BASE_URL}/v1/split/friends`, {
    method: 'POST',
    headers: authHeaders(token, true),
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw await readSplitError(response, 'Unable to add this friend right now.');
  }
  return response.json();
};

export const updateSplitFriend = async (
  token: string,
  friendId: number,
  payload: SplitFriendPayload
): Promise<SplitFriend> => {
  const response = await fetch(`${API_BASE_URL}/v1/split/friends/${friendId}`, {
    method: 'PUT',
    headers: authHeaders(token, true),
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw await readSplitError(response, 'Unable to update this friend right now.');
  }
  return response.json();
};

export const archiveSplitFriend = async (token: string, friendId: number): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/v1/split/friends/${friendId}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  if (!response.ok) {
    throw await readSplitError(response, 'Unable to archive this friend right now.');
  }
};

export const fetchSplitGroups = async (token: string): Promise<SplitGroup[]> => {
  const response = await fetch(`${API_BASE_URL}/v1/split/groups`, {
    headers: authHeaders(token),
  });
  if (!response.ok) {
    throw await readSplitError(response, 'Unable to load split groups right now.');
  }
  const payload: unknown = await response.json();
  if (!Array.isArray(payload)) {
    throw new Error('The split groups response was invalid.');
  }
  return payload as SplitGroup[];
};

export const createSplitGroup = async (
  token: string,
  payload: SplitGroupPayload
): Promise<SplitGroup> => {
  const response = await fetch(`${API_BASE_URL}/v1/split/groups`, {
    method: 'POST',
    headers: authHeaders(token, true),
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw await readSplitError(response, 'Unable to create this split group right now.');
  }
  return response.json();
};

export const updateSplitGroup = async (
  token: string,
  groupId: number,
  payload: SplitGroupPayload
): Promise<SplitGroup> => {
  const response = await fetch(`${API_BASE_URL}/v1/split/groups/${groupId}`, {
    method: 'PUT',
    headers: authHeaders(token, true),
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw await readSplitError(response, 'Unable to update this split group right now.');
  }
  return response.json();
};

export const createSplitGroupInviteLink = async (
  token: string,
  groupId: number
): Promise<SplitGroupInvite> => {
  const response = await fetch(`${API_BASE_URL}/v1/split/groups/${groupId}/invite-link`, {
    method: 'POST',
    headers: authHeaders(token),
  });
  if (!response.ok) {
    throw await readSplitError(response, 'Unable to create this group invite link right now.');
  }
  return response.json();
};

export const createSplitGroupDirectInvite = async (
  token: string,
  groupId: number,
  payload: { email?: string; phone?: string }
): Promise<SplitGroupDirectInvite> => {
  const response = await fetch(`${API_BASE_URL}/v1/split/groups/${groupId}/invites`, {
    method: 'POST',
    headers: authHeaders(token, true),
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw await readSplitError(response, 'Unable to invite this friend right now.');
  }
  return response.json();
};

export const fetchSplitGroupDirectInvites = async (
  token: string,
  groupId: number
): Promise<SplitGroupDirectInvite[]> => {
  const response = await fetch(`${API_BASE_URL}/v1/split/groups/${groupId}/invites`, {
    headers: authHeaders(token),
  });
  if (!response.ok) {
    throw await readSplitError(response, 'Unable to load pending invites right now.');
  }
  const payload: unknown = await response.json();
  if (!Array.isArray(payload)) {
    throw new Error('The pending invites response was invalid.');
  }
  return payload as SplitGroupDirectInvite[];
};

export const revokeSplitGroupDirectInvite = async (
  token: string,
  groupId: number,
  inviteId: number
): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/v1/split/groups/${groupId}/invites/${inviteId}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  if (!response.ok) {
    throw await readSplitError(response, 'Unable to revoke this invite right now.');
  }
};

export const fetchSplitGroupInvite = async (
  token: string,
  inviteToken: string
): Promise<SplitGroupInviteDetails> => {
  const response = await fetch(`${API_BASE_URL}/v1/split/invites/${inviteToken}`, {
    headers: authHeaders(token),
  });
  if (!response.ok) {
    throw await readSplitError(response, 'Unable to load this split group invite right now.');
  }
  return response.json();
};

export const acceptSplitGroupInvite = async (
  token: string,
  inviteToken: string
): Promise<SplitGroupInviteAcceptResponse> => {
  const response = await fetch(`${API_BASE_URL}/v1/split/invites/${inviteToken}/accept`, {
    method: 'POST',
    headers: authHeaders(token),
  });
  if (!response.ok) {
    throw await readSplitError(response, 'Unable to join this split group right now.');
  }
  return response.json();
};

export const archiveSplitGroup = async (token: string, groupId: number): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/v1/split/groups/${groupId}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  if (!response.ok) {
    throw await readSplitError(response, 'Unable to delete this split group right now.');
  }
};

export const leaveSplitGroup = async (token: string, groupId: number): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/v1/split/groups/${groupId}/leave`, {
    method: 'POST',
    headers: authHeaders(token),
  });
  if (!response.ok) {
    throw await readSplitError(response, 'Unable to leave this split group right now.');
  }
};

export const fetchSplitBills = async (token: string): Promise<SplitBill[]> => {
  const response = await fetch(`${API_BASE_URL}/v1/split/bills`, {
    headers: authHeaders(token),
  });
  if (!response.ok) {
    throw await readSplitError(response, 'Unable to load split bills right now.');
  }
  const payload: unknown = await response.json();
  if (!Array.isArray(payload)) {
    throw new Error('The split bills response was invalid.');
  }
  return (payload as SplitBill[]).map(normalizeSplitBill);
};

export const createSplitBill = async (
  token: string,
  payload: SplitBillPayload
): Promise<SplitBill> => {
  const response = await fetch(`${API_BASE_URL}/v1/split/bills`, {
    method: 'POST',
    headers: authHeaders(token, true),
    body: JSON.stringify({ ...payload, currency: payload.currency ?? 'INR' }),
  });
  if (!response.ok) {
    throw await readSplitError(response, 'Unable to save this split bill right now.');
  }
  return normalizeSplitBill(await response.json());
};

export const updateSplitBill = async (
  token: string,
  billId: number,
  payload: SplitBillPayload
): Promise<SplitBill> => {
  const response = await fetch(`${API_BASE_URL}/v1/split/bills/${billId}`, {
    method: 'PUT',
    headers: authHeaders(token, true),
    body: JSON.stringify({ ...payload, currency: payload.currency ?? 'INR' }),
  });
  if (!response.ok) {
    throw await readSplitError(response, 'Unable to update this split bill right now.');
  }
  return normalizeSplitBill(await response.json());
};

export const deleteSplitBill = async (token: string, billId: number): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/v1/split/bills/${billId}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  if (!response.ok) {
    throw await readSplitError(response, 'Unable to remove this split bill right now.');
  }
};

export const fetchSplitSettlements = async (token: string): Promise<SplitSettlement[]> => {
  const response = await fetch(`${API_BASE_URL}/v1/split/settlements`, {
    headers: authHeaders(token),
  });
  if (!response.ok) {
    throw await readSplitError(response, 'Unable to load settlements right now.');
  }
  const payload: unknown = await response.json();
  if (!Array.isArray(payload)) {
    throw new Error('The settlements response was invalid.');
  }
  return (payload as SplitSettlement[]).map((settlement) => ({
    ...settlement,
    amount: Number(settlement.amount),
  }));
};

export const fetchSplitActivity = async (token: string): Promise<SplitActivityItem[]> => {
  const response = await fetch(`${API_BASE_URL}/v1/split/activity`, {
    headers: authHeaders(token),
  });
  if (!response.ok) {
    throw await readSplitError(response, 'Unable to load split activity right now.');
  }
  const payload: unknown = await response.json();
  if (
    !payload ||
    typeof payload !== 'object' ||
    !Array.isArray((payload as SplitActivityResponse).items)
  ) {
    throw new Error('The split activity response was invalid.');
  }
  return (payload as SplitActivityResponse).items.map((item) => ({
    ...item,
    amount: item.amount == null ? undefined : Number(item.amount),
    participants: (item.participants ?? []).map((participant) =>
      coerceAmount(participant as unknown as Record<string, unknown>, ['share_amount'])
    ) as SplitParticipant[],
  }));
};

export const createSplitSettlement = async (
  token: string,
  payload: SplitSettlementPayload
): Promise<SplitSettlement> => {
  const response = await fetch(`${API_BASE_URL}/v1/split/settlements`, {
    method: 'POST',
    headers: authHeaders(token, true),
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw await readSplitError(response, 'Unable to record this settlement right now.');
  }
  return response.json();
};

export const fetchSplitBalances = async (token: string): Promise<SplitBalance[]> => {
  const response = await fetch(`${API_BASE_URL}/v1/split/balances`, {
    headers: authHeaders(token),
  });
  if (!response.ok) {
    throw await readSplitError(response, 'Unable to load split balances right now.');
  }
  const payload: unknown = await response.json();
  if (!Array.isArray(payload)) {
    throw new Error('The split balances response was invalid.');
  }
  return (payload as SplitBalance[]).map((balance) => ({
    ...balance,
    total_owed_by_friend: Number(balance.total_owed_by_friend),
    total_owed_to_friend: Number(balance.total_owed_to_friend),
    net_balance: Number(balance.net_balance),
  }));
};
