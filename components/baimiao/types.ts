export type BaimiaoAccount = {
  id: string;
  username: string;
  mobileMasked?: string;
  hasUuid?: boolean;
  hasLoginToken?: boolean;
};

export type BaimiaoSummary = {
  accounts: BaimiaoAccount[];
  selectedAccountId: string;
  selectedAccount?: {
    username?: string;
    password?: string;
  } | null;
};

export const EMPTY_BAIMIAO_SUMMARY: BaimiaoSummary = {
  accounts: [],
  selectedAccountId: '',
  selectedAccount: null,
};
