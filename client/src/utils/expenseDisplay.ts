import { formatCurrency } from './financeFormat';
import { pluralUnit } from './pluralize';

function titleCaseWord(word: string): string {
  if (!word) {
    return word;
  }
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

export function formatExpenseTitle(description: string): string {
  const trimmed = description.trim();
  if (!trimmed) {
    return '';
  }
  return trimmed.split(/\s+/).map(titleCaseWord).join(' ');
}

type ResolvedKind =
  | 'food'
  | 'transport'
  | 'travel'
  | 'lodging'
  | 'entertainment'
  | 'shopping'
  | 'utilities'
  | 'other';

const KIND_LABEL: Record<ResolvedKind, string> = {
  food: 'Food',
  transport: 'Transport',
  travel: 'Travel',
  lodging: 'Lodging',
  entertainment: 'Entertainment',
  shopping: 'Shopping',
  utilities: 'Utilities',
  other: 'Other',
};

const KIND_ICON: Record<ResolvedKind, string> = {
  food: '🍽️',
  transport: '🚕',
  travel: '✈️',
  lodging: '🏨',
  entertainment: '🎬',
  shopping: '🛍️',
  utilities: '💡',
  other: '🧾',
};

function resolveKindFromKeywords(text: string): ResolvedKind | null {
  if (
    /\b(restaurant|food|grocery|groceries|dinner|lunch|breakfast|cafe|coffee)\b/.test(text)
  ) {
    return 'food';
  }
  if (/\b(uber|lyft|taxi|ride|transport|bus|train|car|gas|parking)\b/.test(text)) {
    return 'transport';
  }
  if (/\b(flight|airline|airport|travel)\b/.test(text)) {
    return 'travel';
  }
  if (/\b(hotel|airbnb|lodging|stay)\b/.test(text)) {
    return 'lodging';
  }
  if (/\b(movie|cinema|ticket|entertainment)\b/.test(text)) {
    return 'entertainment';
  }
  if (/\b(shopping|store|clothes)\b/.test(text)) {
    return 'shopping';
  }
  return null;
}

function resolveKindFromCategoryEnum(cat: string): ResolvedKind {
  const c = cat.toLowerCase();
  if (c === 'food') {
    return 'food';
  }
  if (c === 'transport') {
    return 'transport';
  }
  if (c === 'travel') {
    return 'travel';
  }
  if (c === 'housing') {
    return 'lodging';
  }
  if (c === 'entertainment') {
    return 'entertainment';
  }
  if (c === 'utilities') {
    return 'utilities';
  }
  return 'other';
}

export function resolveExpensePresentation(category: string, description: string): {
  icon: string;
  label: string;
  kind: ResolvedKind;
} {
  const text = `${category} ${description}`.toLowerCase();
  const keywordKind = resolveKindFromKeywords(text);
  const enumKind = resolveKindFromCategoryEnum(category);
  const kind = keywordKind ?? enumKind;
  return {
    kind,
    icon: KIND_ICON[kind],
    label: KIND_LABEL[kind],
  };
}

/** @deprecated Prefer resolveExpensePresentation for icon + label */
export function getExpenseDisplayIcon(category: string, description: string): string {
  return resolveExpensePresentation(category, description).icon;
}

/** @deprecated Prefer resolveExpensePresentation */
export function formatCategoryBadge(category: string): string {
  return resolveExpensePresentation(category, '').label;
}

export function getExpenseCategoryLabel(category: string, description: string): string {
  return resolveExpensePresentation(category, description).label;
}

export function formatEqualSplitLabel(memberCount: number): string {
  if (memberCount <= 1) {
    return 'Split equally';
  }
  return `Split equally · ${pluralUnit(memberCount, 'member', 'members')}`;
}

export type SharePrecision = 'exact' | 'estimated';

export function getEqualShareAmount(totalAmount: number, memberCount: number): number {
  const n = Math.max(memberCount, 1);
  return Math.round((totalAmount / n) * 100) / 100;
}

/**
 * Equal split among current group members is exact for that model (display-only).
 */
export function getExpenseSharePrecision(_expense: unknown): SharePrecision {
  return 'exact';
}

export function getDebtExpenseContextLine(
  expense: { amount: string; paid_by: string; paid_by_name: string },
  debt: {
    fromUserId: string;
    toUserId: string;
    fromUserName: string;
    toUserName: string;
  },
  memberCount: number
): string {
  const share = getEqualShareAmount(Number(expense.amount), Math.max(memberCount, 1));
  if (expense.paid_by === debt.toUserId) {
    return `${debt.fromUserName} owed ${debt.toUserName} about ${formatCurrency(share)} on this expense (equal split across the group).`;
  }
  if (expense.paid_by === debt.fromUserId) {
    return `${debt.fromUserName} paid; ${debt.toUserName}'s share contributes to this settlement pair.`;
  }
  return `Everyone split about ${formatCurrency(share)} per person on this expense.`;
}

const KIND_TO_DB_CATEGORY: Record<ResolvedKind, string> = {
  food: 'food',
  transport: 'transport',
  travel: 'travel',
  lodging: 'housing',
  entertainment: 'entertainment',
  shopping: 'other',
  utilities: 'utilities',
  other: 'other',
};

/** Maps title keywords to a valid `expense_category` enum value for the API. */
export function inferCategoryEnumFromDescription(description: string): string {
  const { kind } = resolveExpensePresentation('other', description);
  return KIND_TO_DB_CATEGORY[kind];
}

export function getExpenseImpactLine(
  expense: { amount: string; paid_by: string; paid_by_name: string },
  currentUserId: string | undefined,
  members: ReadonlyArray<{ user_id: string; display_name: string }>,
  participantCount: number
): string | null {
  if (!currentUserId || participantCount < 2) {
    return null;
  }

  const total = Number(expense.amount);
  const share = getEqualShareAmount(total, participantCount);

  const firstName = (fullName: string): string => {
    const part = fullName.trim().split(/\s+/)[0];
    return part ?? fullName;
  };

  const payerId = expense.paid_by;
  const payerFirst = firstName(expense.paid_by_name);

  if (currentUserId === payerId) {
    const others = members.filter((m) => m.user_id !== payerId);
    if (others.length === 1) {
      return `${firstName(others[0].display_name)} owes you ${formatCurrency(share)} for this expense.`;
    }
    return `${others.length} people owe you ${formatCurrency(share)} each for this expense.`;
  }

  return `You owe ${payerFirst} ${formatCurrency(share)} for this expense.`;
}
