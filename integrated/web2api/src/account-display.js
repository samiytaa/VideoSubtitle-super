export function resolveAccountLabel(account) {
  return [
    account?.loginValue,
    account?.displayName,
    account?.emailMasked,
    account?.mobileMasked,
    account?.id
  ].find(Boolean) || "";
}

export function resolveAccountDetail(account) {
  const label = resolveAccountLabel(account);

  return [
    account?.mobileMasked,
    account?.emailMasked,
    account?.displayName
  ].find((value) => value && value !== label) || "";
}
