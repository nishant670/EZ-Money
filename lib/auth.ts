import { API_BASE_URL } from './transactions';

export type IdentifyResponse = {
  exists: boolean;
  is_guest: boolean;
};

export const identifyUser = async (identifier: string): Promise<IdentifyResponse> => {
  const response = await fetch(`${API_BASE_URL}/v1/auth/identify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ identifier }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || 'Unable to verify that identifier right now.');
  }

  return response.json();
};

type GuestCheckinPayload = {
  device_id: string;
};

type AuthResponse = {
  token: string;
  user: {
    uuid: string;
    is_guest: boolean;
    username: string;
  };
};

export const guestCheckin = async (
  payload: GuestCheckinPayload,
): Promise<AuthResponse> => {
  const response = await fetch(`${API_BASE_URL}/v1/auth/guest`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || 'Unable to check in as guest right now.');
  }

  return response.json();
};

export type RegisterPayload = {
  claim_token: string;
  pin: string;
  guest_uuid?: string;
  device_id: string;
  biometrics_enabled: boolean;
};

export const registerUser = async (payload: RegisterPayload): Promise<AuthResponse> => {
  const response = await fetch(`${API_BASE_URL}/v1/auth/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.json();
    throw new Error(errorText.error || 'Unable to register right now.');
  }

  return response.json();
};

export type LoginPayload = {
  identifier: string;
  pin: string;
  device_id: string;
};

export const loginUser = async (payload: LoginPayload): Promise<AuthResponse> => {
  const response = await fetch(`${API_BASE_URL}/v1/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Invalid credentials.');
  }

  return response.json();
};

export type UpdateProfilePayload = {
  token: string;
  username: string;
  email: string;
  phone: string;
  claim_token?: string;
};

export const updateProfile = async (payload: UpdateProfilePayload): Promise<{ user: AuthResponse['user'] }> => {
  const response = await fetch(`${API_BASE_URL}/v1/user`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${payload.token}`,
    },
    body: JSON.stringify({
      username: payload.username,
      email: payload.email,
      phone: payload.phone,
      claim_token: payload.claim_token,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to update profile.');
  }

  return response.json();
};

export const authOtpSend = async (identifier: string) => {
  // Mock function to simulate OTP send, since backend mocks it too
  const response = await fetch(`${API_BASE_URL}/v1/auth/otp/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier }),
  });
  if (!response.ok) throw new Error('Failed to send OTP');
  return response.json();
};

export const authOtpVerify = async (identifier: string, otp: string): Promise<{ claim_token: string }> => {
  const response = await fetch(`${API_BASE_URL}/v1/auth/otp/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier, otp }),
  });
  if (!response.ok) throw new Error('Invalid OTP');
  return response.json();
};
