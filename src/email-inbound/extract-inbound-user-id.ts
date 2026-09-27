import { validate as isUuid } from 'uuid';

const PLUS_ADDR_RE =
  /nexpensesdev\+([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})@gmail\.com/i;

const SUBJECT_RE =
  /(?:\[nexpenses:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\]|nexpenses:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}))/i;

function firstUuidFromPlusAddresses(values: string[]): string | null {
  for (const value of values) {
    const match = value.match(PLUS_ADDR_RE);
    const id = match?.[1];
    if (id && isUuid(id)) return id.toLowerCase();
  }
  return null;
}

function uuidFromSubject(subject: string | undefined | null): string | null {
  if (!subject) return null;
  const match = subject.match(SUBJECT_RE);
  const id = match?.[1] ?? match?.[2];
  if (id && isUuid(id)) return id.toLowerCase();
  return null;
}

function asHeaderList(
  value: string | string[] | undefined | null,
): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(String);
  return [String(value)];
}

export function extractInboundUserId(input: {
  to?: string | string[] | null;
  deliveredTo?: string | string[] | null;
  xOriginalTo?: string | string[] | null;
  xForwardedTo?: string | string[] | null;
  subject?: string | null;
}): string | null {
  const headerCandidates = [
    ...asHeaderList(input.to),
    ...asHeaderList(input.deliveredTo),
    ...asHeaderList(input.xOriginalTo),
    ...asHeaderList(input.xForwardedTo),
  ];
  return (
    firstUuidFromPlusAddresses(headerCandidates) ??
    uuidFromSubject(input.subject)
  );
}
