import { useEffect, useState } from 'react';
import { usePlaidLink } from 'react-plaid-link';
import { exchangeToken, getLinkToken, type ConnectedAccount } from '../api/plaid';

type Props = {
  onConnected: (accounts: ConnectedAccount[]) => void;
};

export function PlaidLinkButton({ onConnected }: Props) {
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
    } catch {
      setError('Failed to initialize Plaid Link');
    }
  };

  return (
    <div>
      <button
        type="button"
        onClick={() => void handleClick()}
        className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
      >
        Connect Bank Account
      </button>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
