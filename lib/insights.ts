import { getClientTimeZone } from './datetime';
import { API_BASE_URL, type ApiEntry } from './transactions';

export type DashboardSummary = {
    total_spent: number;
    total_income: number;
    daily_average: number;
    transaction_count: number;
};

export type DashboardCategory = {
    category: string;
    amount: number;
    percentage: number;
    change: number;
};

export type DashboardMerchant = {
    merchant: string;
    amount: number;
    transaction_count: number;
};

export type DashboardAccount = {
    account_id: number | null;
    account_name: string;
    amount: number;
    percentage: number;
};

export type DashboardBudgetStatus = {
    budget_id: number;
    name: string;
    category: string;
    limit_amount: number;
    spent_amount: number;
    remaining_amount: number;
    percentage: number;
    alert_threshold_percent: number;
    days_left: number;
    status: 'safe' | 'watch' | 'exceeded';
};

export type DashboardDailySpend = {
    date: string;
    amount: number;
    count: number;
};

export type InsightCard = {
    kind:
        | 'period_comparison'
        | 'category_increase'
        | 'top_merchant'
        | 'account_usage'
        | 'unusual_spending'
        | 'recurring_candidate'
        | 'budget_watch'
        | 'budget_exceeded';
    severity: 'info' | 'warning' | 'success';
    title: string;
    body: string;
    explanation?: string;
    action_label?: string;
    category?: string;
    merchant?: string;
    budget_id?: number;
    account_id?: number | null;
    account_name?: string;
    amount?: number;
    limit_amount?: number;
    remaining_amount?: number;
    status?: string;
    percentage?: number;
    change_percentage?: number;
    transaction_count?: number;
    next_expected_date?: string;
    confidence?: number;
};

export type DashboardRecurringCandidate = {
    candidate_key: string;
    label: string;
    merchant: string;
    category: string;
    average_amount: number;
    interval_guess: 'weekly' | 'monthly';
    confidence: number;
    occurrences: number;
    last_seen_date: string;
    next_expected_date: string;
    review_due: boolean;
};

export type RecurringCandidateDecision = {
    id: number;
    user_id: number;
    candidate_key: string;
    merchant: string;
    category: string;
    decision: 'dismissed' | 'snoozed' | 'tracked';
    snoozed_until?: string;
    last_reviewed_at: string;
    created_at: string;
    updated_at: string;
};

export type DashboardResponse = {
    period: { start: string; end: string };
    summary: DashboardSummary;
    top_categories: DashboardCategory[];
    top_merchants: DashboardMerchant[];
    account_spending: DashboardAccount[];
    budget_statuses: DashboardBudgetStatus[];
    daily_spending: DashboardDailySpend[];
    recent_transactions: ApiEntry[];
    review_items: ApiEntry[];
    insights: InsightCard[];
    recurring_candidates: DashboardRecurringCandidate[];
};

export const fetchDashboard = async (
    token: string,
    startDate?: string,
    endDate?: string,
): Promise<DashboardResponse> => {
    const params = new URLSearchParams();
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    params.append('tz', getClientTimeZone());

    const response = await fetch(`${API_BASE_URL}/v1/dashboard?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
        let message = 'Unable to fetch dashboard right now.';
        try {
            const payload = await response.json() as { error?: string };
            message = payload.error || message;
        } catch {
            // Keep the stable fallback for non-JSON errors.
        }
        throw new Error(message);
    }
    return response.json();
};

export const saveRecurringCandidateDecision = async (
    token: string,
    payload: {
        candidate_key: string;
        merchant?: string;
        category?: string;
        decision: 'dismissed' | 'snoozed' | 'tracked';
        snoozed_until?: string;
    }
): Promise<RecurringCandidateDecision> => {
    const response = await fetch(`${API_BASE_URL}/v1/recurring-candidates/decision`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
    });
    if (!response.ok) {
        let message = 'Unable to save recurring review decision.';
        try {
            const body = await response.json() as { error?: string };
            message = body.error || message;
        } catch {
            // Keep stable fallback.
        }
        throw new Error(message);
    }
    return response.json();
};
