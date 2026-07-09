import { API_BASE_URL } from './transactions';

export type MonthlyHealth = {
    income: number;
    spent: number;
    savings: number;
    savings_rate: number;
    burn_rate: string;
};

export type CategoryBreakdown = {
    category: string;
    amount: number;
    percentage: number;
    change: number;
};

export type MerchantInfo = {
    merchant: string;
    amount: number;
    transaction_count: number;
    icon: string;
};

export type AIInsightCard = {
    type: 'info' | 'warning' | 'success';
    title: string;
    description: string;
    action_label: string;
    action_type: string;
};

export type AccountSpending = {
    type: string;
    amount: number;
    percentage: number;
};

export type CreditUtilization = {
    account_name: string;
    used: number;
    limit: number;
    percentage: number;
    due_date: string;
    warning: boolean;
};

export type EMISummary = {
    total_monthly_emi: number;
    total_lent: number;
    lent_count: number;
};

export type BehavioralInsight = {
    average_daily_spend: number;
    highest_spend_day: string;
};

export type ReviewItem = {
    type: string;
    count: number;
    title: string;
};

export type InsightsResponse = {
    monthly_health: MonthlyHealth;
    category_breakdown: CategoryBreakdown[];
    top_merchants: MerchantInfo[];
    ai_insights: AIInsightCard[];
    account_spending: AccountSpending[];
    credit_utilization: CreditUtilization[];
    emi_summary: EMISummary;
    behavioral_insights: BehavioralInsight;
    review_items: ReviewItem[];
};

export const fetchInsights = async (token: string, startDate?: string, endDate?: string): Promise<InsightsResponse> => {
    let url = `${API_BASE_URL}/v1/insights`;
    const params = new URLSearchParams();
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);

    const queryString = params.toString();
    if (queryString) {
        url += `?${queryString}`;
    }

    const response = await fetch(url, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Unable to fetch insights right now.');
    }

    return response.json();
};
