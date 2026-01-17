export type ScreenProps = {
  onContinue: (data?: any) => void;
  onSecondary?: () => void;
  isLoading?: boolean;
  errorMessage?: string | null;
};
