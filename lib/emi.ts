import { ApiFieldErrors, readApiError } from './api-error';
import { API_BASE_URL } from './transactions';

export type EMICalculationPayload = {
  principal_amount: number;
  annual_interest_rate_percent: number;
  tenure_months: number;
  currency?: 'INR';
};

export type EMIScheduleMonth = {
  month: number;
  opening_balance: number;
  payment_amount: number;
  principal_amount: number;
  interest_amount: number;
  closing_balance: number;
};

export type EMICalculation = {
  principal_amount: number;
  currency: 'INR';
  annual_interest_rate_percent: number;
  tenure_months: number;
  monthly_emi: number;
  total_payment: number;
  total_interest: number;
  schedule: EMIScheduleMonth[];
};

export class EMIApiError extends Error {
  status: number;
  code?: string;
  fields?: ApiFieldErrors;

  constructor(message: string, status: number, code?: string, fields?: ApiFieldErrors) {
    super(message);
    this.name = 'EMIApiError';
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

const emiFieldLabels: Record<string, string> = {
  principal_amount: 'Loan amount',
  annual_interest_rate_percent: 'Interest rate',
  tenure_months: 'Tenure',
  currency: 'Currency',
};

const readEMIError = async (response: Response, fallback: string): Promise<EMIApiError> => {
  const apiError = await readApiError(response, fallback, emiFieldLabels);
  return new EMIApiError(apiError.message, apiError.status, apiError.code, apiError.fields);
};

const authHeaders = (token: string) => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${token}`,
});

const coerceScheduleMonth = (month: EMIScheduleMonth): EMIScheduleMonth => ({
  ...month,
  opening_balance: Number(month.opening_balance),
  payment_amount: Number(month.payment_amount),
  principal_amount: Number(month.principal_amount),
  interest_amount: Number(month.interest_amount),
  closing_balance: Number(month.closing_balance),
});

export const calculateEMI = async (
  token: string,
  payload: EMICalculationPayload,
): Promise<EMICalculation> => {
  const response = await fetch(`${API_BASE_URL}/v1/tools/emi/calculate`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ ...payload, currency: payload.currency ?? 'INR' }),
  });

  if (!response.ok) {
    throw await readEMIError(response, 'Unable to calculate EMI right now.');
  }

  const result = (await response.json()) as EMICalculation;
  return {
    ...result,
    principal_amount: Number(result.principal_amount),
    annual_interest_rate_percent: Number(result.annual_interest_rate_percent),
    monthly_emi: Number(result.monthly_emi),
    total_payment: Number(result.total_payment),
    total_interest: Number(result.total_interest),
    schedule: (result.schedule ?? []).map(coerceScheduleMonth),
  };
};
