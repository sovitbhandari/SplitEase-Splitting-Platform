import type { DebtEntry } from '../api/settlements';

export function formatCurrency(amount: number | string): string {
  const numeric = typeof amount === 'string' ? Number(amount) : amount;
  const safe = Number.isFinite(numeric) ? numeric : 0;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(safe);
}

export function getBalanceLabel(signedAmount: number): {
  text: string;
  tone: 'positive' | 'negative' | 'neutral';
} {
  if (signedAmount > 0.009) {
    return { text: `Gets back ${formatCurrency(signedAmount)}`, tone: 'positive' };
  }
  if (signedAmount < -0.009) {
    return { text: `Owes ${formatCurrency(Math.abs(signedAmount))}`, tone: 'negative' };
  }
  return { text: 'Settled up', tone: 'neutral' };
}

export function getDebtLabel(debt: DebtEntry, currentUserId: string): string {
  if (debt.fromUserId === currentUserId) {
    return `You need to pay ${debt.toUserName} ${formatCurrency(debt.amount)}`;
  }
  if (debt.toUserId === currentUserId) {
    return `${debt.fromUserName} owes you ${formatCurrency(debt.amount)}`;
  }
  return `${debt.fromUserName} pays ${debt.toUserName} ${formatCurrency(debt.amount)}`;
}
