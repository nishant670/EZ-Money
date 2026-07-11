import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import {
  TransactionFormModal,
  type EntryForm,
  type AiReviewMetadata,
} from '@/components/transactions/TransactionFormModal';
import type { Account } from '@/lib/accounts';

const cashAccount: Account = {
  id: 1,
  type: 'cash',
  name: 'Cash',
  color: '#2ECC71',
  is_default: true,
};

const upiAccount: Account = {
  id: 2,
  type: 'upi',
  name: 'HDFC UPI',
  color: '#00D2B4',
  is_default: true,
};

const completeInitialData: Partial<EntryForm> = {
  title: 'Lunch',
  amount: '250.00',
  type: 'Expense',
  mode: 'Cash',
  category: 'Food & Drinks',
  date: '11 July 2026',
  time: '1:30 PM',
  notes: '',
  tag: 'General',
  currency: 'INR',
  accountId: 1,
  account: 'Cash',
  merchant: 'Cafe',
  attachment: null,
};

const renderModal = async ({
  initialData = completeInitialData,
  accounts = [cashAccount],
  aiReview,
  mode = 'manual',
  onSave = jest.fn().mockResolvedValue(undefined),
  onClose = jest.fn(),
}: {
  initialData?: Partial<EntryForm>;
  accounts?: Account[];
  aiReview?: AiReviewMetadata;
  mode?: 'audio' | 'manual' | 'quick-prompt';
  onSave?: jest.Mock<Promise<void>, [EntryForm]>;
  onClose?: jest.Mock;
} = {}) => {
  const result = await render(
    <TransactionFormModal
      visible
      initialData={initialData}
      onSave={onSave}
      onClose={onClose}
      mode={mode}
      aiReview={aiReview}
      accounts={accounts}
    />
  );

  return { ...result, onSave, onClose };
};

describe('TransactionFormModal', () => {
  it('saves edited confirmation fields', async () => {
    const { findByTestId, onSave } = await renderModal();

    await fireEvent.changeText(await findByTestId('entry-title-input'), 'Team lunch');
    await fireEvent.changeText(await findByTestId('entry-amount-input'), '325.50');
    await fireEvent.press(await findByTestId('entry-save-button'));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        title: 'Team lunch',
        amount: '325.50',
        accountId: 1,
      })
    );
  });

  it('shows AI uncertainty and clarification prompts', async () => {
    const { findByText } = await renderModal({
      mode: 'audio',
      aiReview: {
        missingFields: ['date', 'account_hint'],
        confidence: { merchant: 0.4 },
        clarifications: ['Which account paid for this?'],
      },
    });

    expect(await findByText('AI draft')).toBeTruthy();
    expect(await findByText('Check: Date, Account, Merchant')).toBeTruthy();
    expect(await findByText('Which account paid for this?')).toBeTruthy();
    expect(await findByText('AI suggestions are never saved until you confirm.')).toBeTruthy();
  });

  it('preselects the compatible account for the payment mode', async () => {
    const { findByText } = await renderModal({
      accounts: [cashAccount, upiAccount],
      initialData: {
        ...completeInitialData,
        mode: 'UPI',
        accountId: null,
        account: '',
      },
    });

    expect(await findByText('HDFC UPI')).toBeTruthy();
  });

  it('validates required fields before saving', async () => {
    const { findByTestId, findByText, onSave } = await renderModal({
      initialData: {
        ...completeInitialData,
        title: '',
      },
    });

    await fireEvent.press(await findByTestId('entry-save-button'));

    expect(await findByText('Please provide Transaction Title.')).toBeTruthy();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('disables repeat submit while save is pending', async () => {
    let resolveSave: () => void = () => undefined;
    const pendingSave = new Promise<void>((resolve) => {
      resolveSave = resolve;
    });
    const onSave = jest.fn<Promise<void>, [EntryForm]>(() => pendingSave);
    const { findByTestId } = await renderModal({ onSave });
    const saveButton = await findByTestId('entry-save-button');

    const firstPress = fireEvent.press(saveButton);
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(await findByTestId('entry-save-button')).toBeDisabled();

    await fireEvent.press(await findByTestId('entry-save-button'));
    expect(onSave).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveSave();
      await firstPress;
    });
  });
});
