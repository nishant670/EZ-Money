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

export type InsightCard = {
    kind: 'period_comparison' | 'category_increase' | 'top_merchant' | 'account_usage' | 'unusual_spending';
    severity: 'info' | 'warning' | 'success';
    title: string;
    body: string;
};

export type DashboardResponse = {
    period: { start: string; end: string };
    summary: DashboardSummary;
    top_categories: DashboardCategory[];
    top_merchants: DashboardMerchant[];
    account_spending: DashboardAccount[];
    recent_transactions: ApiEntry[];
    insights: InsightCard[];
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
