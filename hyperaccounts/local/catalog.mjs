import { readFileSync } from 'node:fs';

export const catalog = JSON.parse(
  readFileSync(new URL('../lib/pricing.json', import.meta.url), 'utf8'),
);
export const capabilities = JSON.parse(
  readFileSync(new URL('../lib/capabilities.json', import.meta.url), 'utf8'),
);
export const accountFields = [
  'Username',
  'Password',
  'FirstName',
  'LastName',
  'BirthMonth',
  'BirthDay',
  'BirthYear',
  'Gender',
  'RecoveryEmail',
  'PhoneService',
  'PhoneApiKey',
  'PhoneCountry',
  'ProxyType',
  'Proxy',
  'Enable_IMAP_POP3',
  '_2StepVerification',
];

export function estimate(serviceId, count) {
  const service = catalog.services.find((s) => s.id === serviceId);
  if (!service)
    throw new Error('Choose a service ID from the pricing catalog.');
  if (!Number.isSafeInteger(count) || count < 0 || count > 1000000)
    throw new Error('Count must be an integer from 0 to 1,000,000.');
  return {
    serviceId,
    name: service.name,
    currency: 'USD',
    count,
    unitPriceCents: service.price_cents,
    totalCents: service.price_cents * count,
    basis: 'Numbers receiving an SMS code',
    estimated: true,
  };
}

export function validateAccount(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new Error('Account must be an object.');
  for (const [key, value] of Object.entries(input)) {
    if (!accountFields.includes(key))
      throw new Error('Unsupported or read-only account field: ' + key);
    if (typeof value !== 'string' || value.length > 512)
      throw new Error(
        'Account fields must be strings of at most 512 characters.',
      );
  }
  if (
    !input.Username?.trim() ||
    !['1', '2', '3', '7', '10', '11'].includes(input.PhoneService) ||
    !input.PhoneApiKey?.trim()
  )
    throw new Error(
      'Username, supported SMS provider, and SMS API key are required.',
    );
  if (
    ['1', '2', '3'].includes(input.PhoneService) &&
    !/^\d{1,3}$/.test(input.PhoneCountry || '')
  )
    throw new Error(
      'Enter the numeric country code required by this SMS provider.',
    );
  if (input.ProxyType && !['HTTP', 'SOCKS5'].includes(input.ProxyType))
    throw new Error('Proxy type must be HTTP or SOCKS5.');
  if (input.Gender && !['1', '2'].includes(input.Gender))
    throw new Error('Gender uses the engine codes 1 or 2.');
  const birth = [input.BirthYear, input.BirthMonth, input.BirthDay];
  if (birth.some(Boolean)) {
    if (!birth.every((v) => /^\d+$/.test(v || '')))
      throw new Error(
        'Supply all three numeric date-of-birth fields together.',
      );
    const [year, month, day] = birth.map(Number),
      date = new Date(Date.UTC(year, month - 1, day));
    if (
      year < 1900 ||
      year > new Date().getUTCFullYear() ||
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    )
      throw new Error('Enter a valid date of birth.');
  }
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== ''),
  );
}
