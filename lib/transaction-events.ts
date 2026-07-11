type TransactionChangeListener = () => void;

const listeners = new Set<TransactionChangeListener>();

export const notifyTransactionsChanged = () => {
  listeners.forEach((listener) => listener());
};

export const subscribeTransactionsChanged = (listener: TransactionChangeListener) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
