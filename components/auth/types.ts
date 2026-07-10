export type ScreenProps = {
  onContinue: (data?: any) => void;
  onSecondary?: () => void;
  onForgotPin?: () => void;
  isLoading?: boolean;
  errorMessage?: string | null;
};
