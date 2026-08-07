export type ParsedIdentifier =
  { type: 'email'; value: string } | { type: 'phone'; value: string };

// '@' iceren girdi e-posta sayilir (kucuk harfe normalize edilir); digeri
// telefon sayilip E.164'e normalize edilir. Proje Turkiye icin calistigi
// icin yerel format (0xxxxxxxxxx) varsayilan olarak +90 ile tamamlanir.
export function parseEmailOrPhone(input: string): ParsedIdentifier {
  const trimmed = input.trim();
  if (trimmed.includes('@')) {
    return { type: 'email', value: trimmed.toLowerCase() };
  }

  const digits = trimmed.replace(/[^\d+]/g, '');
  let normalized: string;
  if (digits.startsWith('+')) {
    normalized = digits;
  } else if (digits.startsWith('0')) {
    normalized = `+90${digits.slice(1)}`;
  } else if (digits.startsWith('90')) {
    normalized = `+${digits}`;
  } else {
    normalized = `+90${digits}`;
  }
  return { type: 'phone', value: normalized };
}
