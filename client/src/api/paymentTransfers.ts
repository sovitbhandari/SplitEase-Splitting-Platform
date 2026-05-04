import { api } from './axios';

export type PaymentMethodAccount = {
  id: string;
  plaidAccountId: string;
  accountName: string;
  mask: string | null;
  institutionName: string;
  subtype: string;
  type: string;
};

export type GroupPaymentContext = {
  accounts: PaymentMethodAccount[];
  transferAvailable: boolean;
  sandboxCopy: boolean;
};

export async function getGroupPaymentContext(groupId: string): Promise<GroupPaymentContext> {
  const { data } = await api.get<{
    accounts: PaymentMethodAccount[];
    transferAvailable: boolean;
    sandboxCopy: boolean;
  }>(`/api/groups/${groupId}/payment-methods`);
  return {
    accounts: data.accounts,
    transferAvailable: data.transferAvailable,
    sandboxCopy: data.sandboxCopy,
  };
}

export type TransferPreviewResponse = {
  canTransfer: boolean;
  amount: number;
  currency: string;
  debtorName: string;
  receiverName: string;
  estimatedTimeline: string | null;
  message: string;
};

export async function previewGroupTransfer(
  groupId: string,
  settlementId: string,
  body: { fromPlaidAccountId: string; amount: number }
): Promise<TransferPreviewResponse> {
  const { data } = await api.post<TransferPreviewResponse>(
    `/api/groups/${groupId}/settlements/${settlementId}/transfer/preview`,
    body
  );
  return data;
}

export type CreateTransferResponse = {
  id: string;
  plaidTransferId: string;
  sandbox: boolean;
};

export async function createGroupTransfer(
  groupId: string,
  settlementId: string,
  body: { fromPlaidAccountId: string; amount: number; note?: string },
  idempotencyKey: string
): Promise<CreateTransferResponse> {
  const { data } = await api.post<CreateTransferResponse>(
    `/api/groups/${groupId}/settlements/${settlementId}/transfer/create`,
    body,
    {
      headers: { 'Idempotency-Key': idempotencyKey },
    }
  );
  return data;
}

export type GroupTransferRow = {
  id: string;
  settlementKey: string;
  amount: number;
  status: string;
  debtorName: string;
  receiverName: string;
  createdAt: string;
  updatedAt: string;
  note: string | null;
  method: 'sandbox_bank' | 'manual';
  settlementApplied: boolean;
};

export async function getGroupTransfers(groupId: string): Promise<GroupTransferRow[]> {
  const { data } = await api.get<{ transfers: GroupTransferRow[] }>(
    `/api/groups/${groupId}/transfers`
  );
  return data.transfers;
}
