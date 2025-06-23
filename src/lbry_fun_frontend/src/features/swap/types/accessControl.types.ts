export enum AccessState {
  FULL_ACCESS = 'full_access',           // Authenticated + token is live
  AWAITING_LAUNCH = 'awaiting_launch',   // Authenticated + token not live yet
  UNAUTHENTICATED = 'unauthenticated',   // Not logged in
  LOADING = 'loading'                    // Checking auth/token status
}

export interface AccessContext {
  state: AccessState;
  message: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  countdown?: number; // seconds remaining for AWAITING_LAUNCH
  launchTime?: Date; // When the token will go live
}

export interface AccessGuardProps {
  children: React.ReactNode;
  accessState: AccessState;
  countdown?: number;
  launchTime?: Date;
  onAuthenticate?: () => void;
}