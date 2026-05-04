import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getGroupById, updateGroup, type Group, type GroupMember } from '../api/groups';
import { getConnectedAccounts, type ConnectedAccount } from '../api/plaid';
import {
  createGroupTransfer,
  getGroupPaymentContext,
  getGroupTransfers,
  previewGroupTransfer,
  type GroupTransferRow,
  type PaymentMethodAccount,
} from '../api/paymentTransfers';
import { createExpense, deleteExpense, getGroupExpenses, type Expense } from '../api/expenses';
import { getGroupDebts, settleDebt, type DebtEntry } from '../api/settlements';
import { AddExpenseModal } from '../components/AddExpenseModal';
import { BalanceBreakdownModal } from '../components/BalanceBreakdownModal';
import { BalanceDetailsCard } from '../components/BalanceDetailsCard';
import { BalancePanel } from '../components/BalancePanel';
import { ExpenseList } from '../components/ExpenseList';
import { InviteMembersModal } from '../components/InviteMembersModal';
import { MobileTripActionBar } from '../components/MobileTripActionBar';
import { PaymentHistoryCard } from '../components/PaymentHistoryCard';
import { RecordPaymentModal } from '../components/RecordPaymentModal';
import { SendReminderModal } from '../components/SendReminderModal';
import { SettlementPanel } from '../components/SettlementPanel';
import { ToastBanner } from '../components/ToastBanner';
import { TripLeftSidebar } from '../components/TripLeftSidebar';
import { TripRightRail } from '../components/TripRightRail';
import { TripSettingsModal } from '../components/TripSettingsModal';
import { TripWorkspaceHeader } from '../components/TripWorkspaceHeader';
import { useGroupSocket } from '../hooks/useGroupSocket';
import { useAuthStore } from '../store/authStore';
import { useBalanceStore } from '../store/balanceStore';
import { getEqualShareAmount } from '../utils/expenseDisplay';
import { formatCurrency } from '../utils/financeFormat';
import { displayTripName, tripNeedsTitleAttention } from '../utils/tripDisplay';
import { buildSettlementKey } from '../utils/settlementKey';
import { isBlockingPlaidTransfer, latestTransferForSettlementKey } from '../utils/transferDisplay';

function extractApiError(err: unknown, fallback: string): string {
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
  if (err instanceof Error) {
    return err.message;
  }
  return fallback;
}

export function GroupDetailPage() {
  const params = useParams<{ id: string }>();
  const groupId = params.id ?? '';
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [debts, setDebts] = useState<DebtEntry[]>([]);
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [groupTransfers, setGroupTransfers] = useState<GroupTransferRow[]>([]);
  const [payCtx, setPayCtx] = useState<{
    accounts: PaymentMethodAccount[];
    transferAvailable: boolean;
    sandboxCopy: boolean;
    loading: boolean;
  }>({
    accounts: [],
    transferAvailable: false,
    sandboxCopy: true,
    loading: true,
  });
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [expenseSaving, setExpenseSaving] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [recordDebt, setRecordDebt] = useState<DebtEntry | null>(null);
  const [recordSaving, setRecordSaving] = useState(false);
  const [recordError, setRecordError] = useState<string | null>(null);
  const [reminderDebt, setReminderDebt] = useState<DebtEntry | null>(null);
  const [sessionPayments, setSessionPayments] = useState<Array<{ id: string; label: string }>>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'expenses' | 'balances' | 'settings'>(
    'overview'
  );
  const [error, setError] = useState<string | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [breakdownDebt, setBreakdownDebt] = useState<DebtEntry | null>(null);
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

  const loadPaymentData = useCallback(async (): Promise<void> => {
    if (!groupId) {
      return;
    }
    setPayCtx((prev) => ({ ...prev, loading: true }));
    try {
      const [ctx, tr] = await Promise.all([
        getGroupPaymentContext(groupId),
        getGroupTransfers(groupId),
      ]);
      setPayCtx({ ...ctx, loading: false });
      setGroupTransfers(tr);
    } catch {
      setPayCtx((prev) => ({ ...prev, loading: false }));
    }
  }, [groupId]);

  const transferIdempotencyRef = useRef<string>('');

  const refreshMembers = useCallback(async (): Promise<void> => {
    if (!groupId) {
      return;
    }
    const data = await getGroupById(groupId);
    setGroup(data.group);
    setMembers(data.members);
  }, [groupId]);

  const onSocketGroupDataRefresh = useCallback(() => {
    void refreshGroupData();
    void loadPaymentData();
  }, [refreshGroupData, loadPaymentData]);

  useGroupSocket(
    groupId,
    () => {
      void refreshMembers();
    },
    onSocketGroupDataRefresh
  );

  useEffect(() => {
    void (async () => {
      setPageLoading(true);
      setError(null);
      try {
        await refreshMembers();
        await refreshGroupData();
        const acct = await getConnectedAccounts();
        setAccounts(acct);
        await loadPaymentData();
      } catch {
        setError('Failed to load group details');
      } finally {
        setPageLoading(false);
      }
    })();
  }, [groupId, loadPaymentData, refreshGroupData, refreshMembers]);

  const openDebtsCount = debts.length;
  const membersCount = members.length;
  const memberCountSafe = Math.max(members.length, 1);

  const userSignedBalance = user
    ? (() => {
        const balance = balancesMap[user.id];
        if (!balance || balance.direction === 'settled') {
          return 0;
        }
        return balance.direction === 'owed' ? balance.amount : -balance.amount;
      })()
    : 0;

  const balanceDetails = useMemo(() => {
    const totalGroupExpenses = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
    const youPaid = user
      ? expenses
          .filter((e) => e.paid_by === user.id)
          .reduce((sum, e) => sum + Number(e.amount), 0)
      : 0;
    const yourShareEstimate = expenses.reduce(
      (sum, e) => sum + getEqualShareAmount(Number(e.amount), memberCountSafe),
      0
    );
    return {
      totalGroupExpenses,
      youPaid,
      yourShareEstimate,
      netBalance: userSignedBalance,
    };
  }, [expenses, memberCountSafe, user, userSignedBalance]);

  const focusSettlement = useCallback((): void => {
    setActiveTab('overview');
    window.requestAnimationFrame(() => {
      document.getElementById('settlement-plan')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    });
  }, []);

  const openTripSettings = useCallback((): void => {
    setSettingsError(null);
    setSettingsOpen(true);
  }, []);

  const tripDisplay = displayTripName(group?.name);
  const needsTitle = tripNeedsTitleAttention(group?.name);
  const interactionLocked = expenseSaving || settingsSaving || recordSaving;

  const showMobileSettle =
    userSignedBalance > 0.009 || userSignedBalance < -0.009 || openDebtsCount > 0;

  const expenseListProps = {
    expenses,
    members,
    memberCount: memberCountSafe,
    currentUserId: user?.id,
    onDeleteExpense: async (expense: Expense) => {
      await deleteExpense(groupId, expense.id);
      await refreshGroupData();
    },
  };

  const appendPaymentActivity = useCallback((from: string, to: string, amount: number) => {
    const label = `${from} paid ${to} ${formatCurrency(amount)}`;
    setSessionPayments((prev) => [{ id: crypto.randomUUID(), label }, ...prev].slice(0, 20));
  }, []);

  return (
    <div className="mx-auto w-full max-w-[min(1280px,100%)] px-4 pb-28 pt-6 xl:px-6 xl:pb-6">
      {error && (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[260px_minmax(0,1fr)_300px]">
        <TripLeftSidebar
          className="order-2 xl:order-1"
          group={group}
          members={members}
          user={
            user ? { display_name: user.display_name, email: user.email } : null
          }
          onCopyInvite={() => setToastMessage('Invite code copied.')}
          onOpenInviteModal={() => setInviteOpen(true)}
          onOpenSettings={openTripSettings}
          showTripEditHint={needsTitle}
          onEditTrip={openTripSettings}
        />

        <main className="order-1 min-w-0 space-y-4 xl:order-2">
          {pageLoading ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="animate-pulse space-y-3">
                <div className="h-7 w-56 rounded-lg bg-slate-200" />
                <div className="h-4 max-w-xl rounded bg-slate-100" />
                <div className="h-4 max-w-md rounded bg-slate-100" />
                <div className="mt-4 flex gap-2">
                  <div className="h-10 w-28 rounded-xl bg-slate-200" />
                  <div className="h-10 w-36 rounded-xl bg-slate-100" />
                </div>
              </div>
            </div>
          ) : (
            <TripWorkspaceHeader
              tripName={tripDisplay}
              membersCount={membersCount}
              expenseCount={expenses.length}
              openDebtsCount={openDebtsCount}
              userSignedBalance={userSignedBalance}
              onSettleUp={focusSettlement}
              onAddExpense={() => setExpenseModalOpen(true)}
              showEditTrip={needsTitle}
              onEditTrip={openTripSettings}
              showGroupSettlementCta
            />
          )}

          <div className="rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
            <div className="flex flex-wrap gap-2">
              {(['overview', 'expenses', 'balances', 'settings'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`rounded-xl px-3 py-2 text-xs font-semibold capitalize transition ${
                    activeTab === tab
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'border border-transparent text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {activeTab === 'overview' && user && (
            <>
              <BalanceDetailsCard
                totalGroupExpenses={balanceDetails.totalGroupExpenses}
                youPaid={balanceDetails.youPaid}
                yourShareEstimate={balanceDetails.yourShareEstimate}
                netBalance={balanceDetails.netBalance}
              />
              <SettlementPanel
                currentUserId={user.id}
                debts={debts}
                groupTransfers={groupTransfers}
                interactionLocked={interactionLocked}
                onRecordPayment={(debt) => {
                  setRecordError(null);
                  transferIdempotencyRef.current = '';
                  setRecordDebt(debt);
                  void loadPaymentData();
                }}
                onSendReminder={(debt) => setReminderDebt(debt)}
                onViewBreakdown={(debt) => setBreakdownDebt(debt)}
              />
              <PaymentHistoryCard transfers={groupTransfers} />
              <ExpenseList {...expenseListProps} />
            </>
          )}

          {activeTab === 'expenses' && <ExpenseList {...expenseListProps} />}
          {activeTab === 'balances' && <BalancePanel members={members} />}
          {activeTab === 'settings' && (
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-lg font-semibold text-slate-900">Trip settings</h3>
              <p className="mt-2 text-sm text-slate-600">
                Rename the trip, update the description, and manage how this workspace reads for
                your group. Only admins can save changes.
              </p>
              <button
                type="button"
                onClick={openTripSettings}
                className="mt-4 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
              >
                Open trip settings
              </button>
            </section>
          )}
        </main>

        <TripRightRail
          className="order-3 xl:order-3"
          userSignedBalance={userSignedBalance}
          members={members}
          expenses={expenses}
          accounts={accounts}
          sessionActivity={sessionPayments}
          onSettleUp={focusSettlement}
          onAccountsUpdated={(next) => {
            setAccounts(next);
            void loadPaymentData();
          }}
        />
      </div>

      <ToastBanner message={toastMessage} onDismiss={() => setToastMessage(null)} />

      <MobileTripActionBar
        showSettleUp={showMobileSettle}
        onAddExpense={() => setExpenseModalOpen(true)}
        onSettleUp={focusSettlement}
      />

      {inviteOpen && group ? (
        <InviteMembersModal
          inviteCode={group.invite_code}
          tripName={tripDisplay}
          onClose={() => setInviteOpen(false)}
          onCopyCode={() => setToastMessage('Invite code copied.')}
          onCopyLink={() => setToastMessage('Invite link copied.')}
        />
      ) : null}

      {settingsOpen && group ? (
        <TripSettingsModal
          group={group}
          loading={settingsSaving}
          error={settingsError}
          onClose={() => {
            setSettingsOpen(false);
            setSettingsError(null);
          }}
          onSave={async (payload) => {
            setSettingsSaving(true);
            setSettingsError(null);
            try {
              const next = await updateGroup(groupId, {
                name: payload.name,
                description: payload.description,
              });
              setGroup(next);
              await refreshMembers();
              setToastMessage('Trip settings updated.');
              setSettingsOpen(false);
            } catch (err: unknown) {
              setSettingsError(extractApiError(err, 'Could not update trip settings'));
            } finally {
              setSettingsSaving(false);
            }
          }}
        />
      ) : null}

      {recordDebt && user ? (
        <RecordPaymentModal
          debt={recordDebt}
          tripName={tripDisplay}
          canRecord={recordDebt.fromUserId === user.id}
          loading={recordSaving}
          error={recordError}
          transferFeatureEnabled={payCtx.transferAvailable}
          sandboxCopy={payCtx.sandboxCopy}
          paymentAccounts={payCtx.accounts}
          paymentContextLoading={payCtx.loading}
          hasBlockingPlaidTransfer={isBlockingPlaidTransfer(
            latestTransferForSettlementKey(
              groupTransfers,
              buildSettlementKey(recordDebt.fromUserId, recordDebt.toUserId)
            )
          )}
          onRefreshPaymentContext={loadPaymentData}
          onPlaidConnected={(connected) => {
            setAccounts(connected);
            void loadPaymentData();
          }}
          onPreviewSandbox={async (input) =>
            previewGroupTransfer(
              groupId,
              buildSettlementKey(recordDebt.fromUserId, recordDebt.toUserId),
              input
            )
          }
          onConfirmSandbox={async (input) => {
            setRecordSaving(true);
            setRecordError(null);
            try {
              if (!transferIdempotencyRef.current) {
                transferIdempotencyRef.current = `splitease-${user.id}-${buildSettlementKey(
                  recordDebt.fromUserId,
                  recordDebt.toUserId
                )}-${Date.now()}`;
              }
              await createGroupTransfer(
                groupId,
                buildSettlementKey(recordDebt.fromUserId, recordDebt.toUserId),
                {
                  fromPlaidAccountId: input.fromPlaidAccountId,
                  amount: input.amount,
                  note: input.note || undefined,
                },
                transferIdempotencyRef.current
              );
              await refreshGroupData();
              await loadPaymentData();
              appendPaymentActivity(
                recordDebt.fromUserName,
                recordDebt.toUserName,
                input.amount
              );
              setToastMessage(
                'Sandbox bank payment started. Balances update when Plaid marks the transfer posted (simulated in Sandbox).'
              );
              setRecordDebt(null);
            } catch (err: unknown) {
              setRecordError(extractApiError(err, 'Payment could not be started'));
            } finally {
              setRecordSaving(false);
            }
          }}
          onClose={() => {
            setRecordDebt(null);
            setRecordError(null);
            transferIdempotencyRef.current = '';
          }}
          onConfirm={async (input) => {
            setRecordSaving(true);
            setRecordError(null);
            try {
              const data = await settleDebt(groupId, {
                fromUserId: recordDebt.fromUserId,
                toUserId: recordDebt.toUserId,
                amount: input.amount,
                method: 'cash',
                note: input.note || undefined,
                paymentDate: input.paymentDate,
              });
              setBalances(data.balances);
              setDebts(data.debts);
              await refreshGroupData();
              await loadPaymentData();
              appendPaymentActivity(
                recordDebt.fromUserName,
                recordDebt.toUserName,
                input.amount
              );
              setToastMessage('Manual payment recorded.');
              setRecordDebt(null);
            } catch (err: unknown) {
              setRecordError(extractApiError(err, 'Could not record payment'));
            } finally {
              setRecordSaving(false);
            }
          }}
        />
      ) : null}

      {reminderDebt ? (
        <SendReminderModal
          debt={reminderDebt}
          tripName={tripDisplay}
          onClose={() => setReminderDebt(null)}
          onCopyMessage={() => setToastMessage('Reminder message copied.')}
        />
      ) : null}

      <BalanceBreakdownModal
        debt={breakdownDebt}
        expenses={expenses}
        memberCount={memberCountSafe}
        onClose={() => setBreakdownDebt(null)}
      />

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
              await loadPaymentData();
            } finally {
              setExpenseSaving(false);
            }
          }}
        />
      )}

    </div>
  );
}
