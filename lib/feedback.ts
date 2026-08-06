import { API_BASE_URL } from './transactions';

export type FeedbackType = 'bug' | 'idea' | 'improvement' | 'feature_request' | 'other';
export type FeedbackImpact = 'critical' | 'high' | 'medium' | 'nice_to_have';

export type FeedbackPayload = {
  type: FeedbackType;
  area: string;
  title: string;
  message: string;
  impact: FeedbackImpact;
};

const authHeaders = (token: string) => ({
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json',
});

export const submitFeedback = async (token: string, payload: FeedbackPayload) => {
  const response = await fetch(`${API_BASE_URL}/v1/feedback`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error('Unable to send feedback right now.');
  }

  return response.json();
};
