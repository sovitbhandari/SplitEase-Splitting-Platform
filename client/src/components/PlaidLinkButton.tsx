import { useEffect, useState } from 'react';
import { usePlaidLink } from 'react-plaid-link';
import { exchangeToken, getLinkToken, type ConnectedAccount } from '../api/plaid';

function linkInitErrorMessage(err: unknown, fallback: string): string {
  if (
    err &&
    typeof err === 'object' &&
    'response' in err &&
    err.response &&
    typeof err.response === 'object' &&
    'data' in err.response &&
    err.response.data &&
    typeof err.response.data === 'object' &&
    'error' in err.response.data &&
    typeof (err.response.data as { error: unknown }).error === 'string'
  ) {
    return (err.response.data as { error: string }).error;
  }
  if (err instanceof Error && err.message.trim()) {
    return err.message;
  }
  return fallback;
}

type Props = {
  onConnected: (accounts: ConnectedAccount[]) => void;
  'aria-label'?: string;
};

export function PlaidLinkButton({ onConnected, 'aria-label': ariaLabel }: Props) {
  const [token, setToken] = useState<string | null>(null);
  const [pendingOpen, setPendingOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { open, ready } = usePlaidLink({
    token,
    onSuccess: (publicToken) => {
      void (async () => {
        const accounts = await exchangeToken(publicToken);
        onConnected(accounts);
      })();
    },
    onExit: () => {
      setPendingOpen(false);
    },
  });

  useEffect(() => {
    if (pendingOpen && ready) {
      open();
      setPendingOpen(false);
    }
  }, [open, pendingOpen, ready]);

  const handleClick = async (): Promise<void> => {
    setError(null);
    try {
      const linkToken = await getLinkToken();
      setToken(linkToken);
      setPendingOpen(true);
    } catch (err: unknown) {
      setError(
        linkInitErrorMessage(
          err,
          'Failed to initialize Plaid Link. Check the browser network tab and server logs.'
        )
      );
    }
  };

  return (
    <div>
      <button
        type="button"
        onClick={() => void handleClick()}
        className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
        aria-label={ariaLabel ?? 'Connect bank account'}
      >
        Connect Bank Account
      </button>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
