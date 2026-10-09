type ClassValue = string | false | null | undefined;

/** Minimal className joiner; drops falsy values. */
export const cn = (...values: ClassValue[]): string => values.filter(Boolean).join(' ');
