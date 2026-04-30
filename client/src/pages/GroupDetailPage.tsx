import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getGroupById, type Group, type GroupMember } from '../api/groups';
import { getConnectedAccounts, type ConnectedAccount } from '../api/plaid';
import { createExpense, deleteExpense, getGroupExpenses, type Expense } from '../api/expenses';
import { getGroupDebts, settleDebt, type DebtEntry } from '../api/settlements';
import { AddExpenseModal } from '../components/AddExpenseModal';
import { BalancePanel } from '../components/BalancePanel';
import { ConnectedAccounts } from '../components/ConnectedAccounts';
import { ExpenseList } from '../components/ExpenseList';
import { PlaidLinkButton } from '../components/PlaidLinkButton';
import { SettlementPanel } from '../components/SettlementPanel';
import { useGroupSocket } from '../hooks/useGroupSocket';
import { useAuthStore } from '../store/authStore';
import { useBalanceStore } from '../store/balanceStore';
import { formatCurrency } from '../utils/financeFormat';

export function GroupDetailPage() {
  const params = useParams<{ id: string }>();
  const groupId = params.id ?? '';
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [debts, setDebts] = useState<DebtEntry[]>([]);
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [expenseSaving, setExpenseSaving] = useState(false);
  const [payingDebt, setPayingDebt] = useState<DebtEntry | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payError, setPayError] = useState<string | null>(null);
  const [paySubmitting, setPaySubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'expenses' | 'balances' | 'settings'>(
    'overview'
  );
  const [error, setError] = useState<string | null>(null);
  const user = useAuthStore((state) => state.user);
  const setBalances = useBalanceStore((state) => state.setBalances);
  const balancesMap = useBalanceStore((state) => state.balances);

  const refreshGroupData = useCallback(async (): Promise<void> => {
    if (!groupId) {
      return;
    }
    const expenseData = await getGroupExpenses(groupId);
    setExpenses(expenseData.expenses);
    setBalances(expenseData.balances);
    const debtData = await getGroupDebts(groupId);
    setDebts(debtData);
  }, [groupId, setBalances]);

  const refreshMembers = useCallback(async (): Promise<void> => {
    if (!groupId) {
      return;
    }
    const data = await getGroupById(groupId);
    setGroup(data.group);
    setMembers(data.members);
  }, [groupId]);

  useGroupSocket(
    groupId,
    () => {
      void refreshMembers();
    },
    () => {
      void refreshGroupData();
    }
  );

  useEffect(() => {
    void (async () => {
      try {
        await refreshMembers();
        await refreshGroupData();
        const acct = await getConnectedAccounts();
        setAccounts(acct);
      } catch {
        setError('Failed to load group details');
      }
    })();
  }, [groupId, refreshGroupData, refreshMembers]);

  const totalExpenses = expenses.reduce((sum, expense) => sum + Number(expense.amount), 0);
  const openDebtsCount = debts.length;
  const membersCount = members.length;
  const userSignedBalance = user
    ? (() => {
        const balance = balancesMap[user.id];
        if (!balance || balance.direction === 'settled') {
          return 0;
        }
        return balance.direction === 'owed' ? balance.amount : -balance.amount;
      })()
    : 0;
  const totalPaidByUser = user
    ? expenses
        .filter((expense) => expense.paid_by === user.id)
        .reduce((sum, expense) => sum + Number(expense.amount), 0)
    : 0;
  const yourShare = totalPaidByUser - userSignedBalance;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 lg:px-6">
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      <div className="grid gap-4 xl:grid-cols-[260px_minmax(0,1fr)_320px]">
        <aside className="order-1 rounded-xl border border-slate-200 bg-white p-4 shadow-sm xl:sticky xl:top-4 xl:h-fit">
          <Link to="/dashboard" className="text-sm text-indigo-600 hover:text-indigo-500">
            ← Back to Dashboard
          </Link>
          {group && (
            <div className="mt-4">
              <h1 className="text-2xl font-bold text-slate-900">{group.name}</h1>
              <p className="mt-1 text-sm text-slate-600">
                {group.description || 'No trip description added yet.'}
              </p>
              <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-[11px] text-slate-500">Invite code</p>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <p className="truncate text-xs text-slate-700">{group.invite_code}</p>
                  <button
                    type="button"
                    onClick={() => void navigator.clipboard.writeText(group.invite_code)}
                    className="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                  >
                    Copy
                  </button>
                </div>
              </div>
            </div>
          )}
          <div className="mt-4">
            <h2 className="text-sm font-semibold text-slate-900">Members</h2>
            <ul className="mt-2 space-y-2">
              {members.map((member) => (
                <li key={member.user_id} className="flex items-center justify-between text-sm">
                  <span className="text-slate-800">{member.display_name}</span>
                  <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
                    {member.role}
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                disabled
                className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-400"
                title="Invite member UI coming soon"
              >
                Invite
              </button>
              <button
                type="button"
                disabled
                className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-400"
                title="Group settings coming soon"
              >
                Settings
              </button>
            </div>
          </div>
          {user && (
            <div className="mt-4 rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-2 text-xs">
              <p className="font-semibold text-indigo-700">Logged in as</p>
              <p className="text-indigo-600">{user.display_name}</p>
              <p className="truncate text-indigo-500">{user.email}</p>
            </div>
          )}
        </aside>

        <main className="order-2 min-w-0 space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Trip Overview</h2>
                <p className="text-sm text-slate-600">
                  {userSignedBalance > 0
                    ? `You are owed ${formatCurrency(userSignedBalance)}`
                    : userSignedBalance < 0
                      ? `You need to pay ${formatCurrency(Math.abs(userSignedBalance))}`
                      : 'You are settled up'}
                </p>
              </div>
              <button
                type="button"
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-indigo-500"
                onClick={() => setExpenseModalOpen(true)}
              >
                Add Expense
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {(['overview', 'expenses', 'balances', 'settings'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`rounded px-3 py-1.5 text-xs font-medium capitalize ${
                    activeTab === tab
                      ? 'bg-indigo-600 text-white'
                      : 'border border-slate-300 text-slate-700'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {activeTab === 'overview' && user && (
            <>
              <SettlementPanel
                currentUserId={user.id}
                debts={debts}
                onCashSettle={async (debt, amount) => {
                  const data = await settleDebt(groupId, {
                    fromUserId: debt.fromUserId,
                    toUserId: debt.toUserId,
                    amount,
                    method: 'cash',
                  });
                  setBalances(data.balances);
                  setDebts(data.debts);
                  await refreshGroupData();
                }}
                onPay={async (debt) => {
                  setPayError(null);
                  setPayingDebt(debt);
                  setPayAmount(debt.amount.toFixed(2));
                }}
              />
              <ExpenseList
                expenses={expenses}
                onDeleteExpense={async (expense) => {
                  await deleteExpense(groupId, expense.id);
                  await refreshGroupData();
                }}
              />
            </>
          )}

          {activeTab === 'expenses' && (
            <ExpenseList
              expenses={expenses}
              onDeleteExpense={async (expense) => {
                await deleteExpense(groupId, expense.id);
                await refreshGroupData();
              }}
            />
          )}
          {activeTab === 'balances' && <BalancePanel members={members} />}
          {activeTab === 'settings' && (
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-lg font-semibold text-slate-900">Trip Settings</h3>
              <p className="mt-2 text-sm text-slate-500">
                Group settings and member permissions UI will be added here.
              </p>
            </section>
          )}
        </main>

        <aside className="order-3 space-y-4">
          {user && (
            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="text-base font-semibold text-slate-900">Your Summary</h3>
              <p className="mt-1 text-sm text-slate-600">
                {userSignedBalance > 0
                  ? `You are owed ${formatCurrency(userSignedBalance)}`
                  : userSignedBalance < 0
                    ? `You owe ${formatCurrency(Math.abs(userSignedBalance))}`
                    : 'You are settled up'}
              </p>
              <div className="mt-3 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">Total paid</span>
                  <span className="font-semibold text-slate-900">
                    {formatCurrency(totalPaidByUser)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">Your share</span>
                  <span className="font-semibold text-slate-900">{formatCurrency(yourShare)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">Net balance</span>
                  <span
                    className={`font-semibold ${
                      userSignedBalance > 0
                        ? 'text-emerald-600'
                        : userSignedBalance < 0
                          ? 'text-rose-600'
                          : 'text-slate-700'
                    }`}
                  >
                    {formatCurrency(userSignedBalance)}
                  </span>
                </div>
              </div>
            </section>
          )}

          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-base font-semibold text-slate-900">Quick Stats</h3>
            <div className="mt-2 space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Total expenses</span>
                <span className="font-semibold text-slate-900">{formatCurrency(totalExpenses)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Open debts</span>
                <span className="font-semibold text-slate-900">{openDebtsCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Members</span>
                <span className="font-semibold text-slate-900">{membersCount}</span>
              </div>
            </div>
          </section>

          <BalancePanel members={members} />

          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-base font-semibold text-slate-900">Bank Connection</h3>
            <p className="mt-1 text-xs text-slate-500">
              Connect your sandbox account to use in-app pay flow.
            </p>
            <div className="mt-3">
              <PlaidLinkButton onConnected={setAccounts} />
            </div>
            <div className="mt-3">
              <ConnectedAccounts accounts={accounts} />
            </div>
          </section>
        </aside>
      </div>

      {expenseModalOpen && user && (
        <AddExpenseModal
          members={members}
          paidBy={user.id}
          loading={expenseSaving}
          onClose={() => setExpenseModalOpen(false)}
          onSubmit={async (payload) => {
            setExpenseSaving(true);
            try {
              await createExpense(groupId, payload);
              await refreshGroupData();
            } finally {
              setExpenseSaving(false);
            }
          }}
        />
      )}

      {payingDebt && user && (
        <div className="fixed inset-0 z-30 bg-black/40 p-4">
          <div className="mx-auto mt-16 max-w-md rounded-xl bg-white p-5 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">Pay Debt</h3>
            <p className="mt-1 text-sm text-slate-600">
              You are paying <span className="font-semibold">{payingDebt.toUserName}</span>
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Open debt: ${payingDebt.amount.toFixed(2)}
            </p>
            <div className="mt-3">
              <label className="mb-1 block text-xs font-medium text-slate-700">
                Amount to pay
              </label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={payAmount}
                onChange={(event) => setPayAmount(event.target.value)}
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-medium text-slate-700">
                Link bank account first
              </p>
              <p className="mt-1 text-xs text-slate-500">
                You can only use Pay after connecting an account.
              </p>
              <div className="mt-2">
                <PlaidLinkButton
                  onConnected={(connected) => {
                    setAccounts(connected);
                    setPayError(null);
                  }}
                />
              </div>
            </div>

            {payError && <p className="mt-3 text-sm text-rose-600">{payError}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="rounded border border-slate-300 px-3 py-2 text-sm"
                onClick={() => {
                  setPayingDebt(null);
                  setPayError(null);
                }}
                disabled={paySubmitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded bg-indigo-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                disabled={paySubmitting}
                onClick={() =>
                  void (async () => {
                    const amount = Number(payAmount);
                    if (!Number.isFinite(amount) || amount <= 0) {
                      setPayError('Enter a valid amount');
                      return;
                    }
                    if (amount > payingDebt.amount) {
                      setPayError('Amount cannot exceed current debt');
                      return;
                    }
                    if (accounts.length === 0) {
                      setPayError('Connect a bank account before paying');
                      return;
                    }
                    setPaySubmitting(true);
                    setPayError(null);
                    try {
                      const data = await settleDebt(groupId, {
                        fromUserId: payingDebt.fromUserId,
                        toUserId: payingDebt.toUserId,
                        amount,
                        method: 'pay',
                      });
                      setBalances(data.balances);
                      setDebts(data.debts);
                      await refreshGroupData();
                      setPayingDebt(null);
                    } catch (err: unknown) {
                      const message =
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
                          ? (err.response.data as { error: string }).error
                          : err instanceof Error
                            ? err.message
                            : 'Payment failed';
                      setPayError(message);
                    } finally {
                      setPaySubmitting(false);
                    }
                  })()
                }
              >
                {paySubmitting ? 'Processing...' : 'Confirm Pay'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
