export type ColombianBankCode =
  | 'NU'
  | 'LULO'
  | 'ICETEX'
  | 'BANCO_BOGOTA'
  | 'BANCOLOMBIA'
  | 'DAVIVIENDA'
  | 'BBVA'
  | 'BANCO_OCCIDENTE'
  | 'BANCO_POPULAR'
  | 'AV_VILLAS'
  | 'CAJA_SOCIAL'
  | 'SCOTIABANK_COLPATRIA'
  | 'NEQUI'
  | 'RAPPICARD'
  | 'FALABELLA'
  | 'PICHINCHA'
  | 'AGRARIO'
  | 'SERFINANZA'
  | 'BAN100'
  | 'IRIS'
  | 'GENERIC';

export type ColombianBankEntry = {
  code: ColombianBankCode;
  label: string;
  aliases: readonly string[];
};

export const COLOMBIAN_BANKS: readonly ColombianBankEntry[] = [
  {
    code: 'NU',
    label: 'Nu',
    aliases: [
      'nu financiera',
      'nu colombia',
      'ayuda@nu.com.co',
      'nucf.com.co',
      'nu bank',
      'nubank',
    ],
  },
  {
    code: 'LULO',
    label: 'Lulo',
    aliases: ['lulo bank', 'lulobank', 'lulo'],
  },
  {
    code: 'ICETEX',
    label: 'ICETEX',
    aliases: ['icetex'],
  },
  {
    code: 'BANCO_BOGOTA',
    label: 'Banco de Bogotá',
    aliases: ['banco de bogota', 'bancodebogota', 'banco bogota', 'bbogota'],
  },
  {
    code: 'BANCOLOMBIA',
    label: 'Bancolombia',
    aliases: ['bancolombia', 'sucursal virtual personas', 'grupo bancolombia'],
  },
  {
    code: 'DAVIVIENDA',
    label: 'Davivienda',
    aliases: ['davivienda', 'banco davivienda'],
  },
  {
    code: 'BBVA',
    label: 'BBVA',
    aliases: ['bbva colombia', 'bbva'],
  },
  {
    code: 'BANCO_OCCIDENTE',
    label: 'Banco de Occidente',
    aliases: ['banco de occidente', 'banco occidente'],
  },
  {
    code: 'BANCO_POPULAR',
    label: 'Banco Popular',
    aliases: ['banco popular'],
  },
  {
    code: 'AV_VILLAS',
    label: 'Banco AV Villas',
    aliases: ['av villas', 'banco av villas', 'avvillas'],
  },
  {
    code: 'CAJA_SOCIAL',
    label: 'Banco Caja Social',
    aliases: ['banco caja social', 'caja social'],
  },
  {
    code: 'SCOTIABANK_COLPATRIA',
    label: 'Scotiabank Colpatria',
    aliases: [
      'scotiabank colpatria',
      'scotiabank',
      'colpatria',
      'banco colpatria',
    ],
  },
  {
    code: 'NEQUI',
    label: 'Nequi',
    aliases: ['nequi'],
  },
  {
    code: 'RAPPICARD',
    label: 'RappiCard',
    aliases: ['rappicard', 'rappi card', 'rappi banco'],
  },
  {
    code: 'FALABELLA',
    label: 'Banco Falabella',
    aliases: ['banco falabella', 'cmr falabella', 'falabella', 'tarjeta cmr'],
  },
  {
    code: 'PICHINCHA',
    label: 'Banco Pichincha',
    aliases: ['banco pichincha', 'pichincha'],
  },
  {
    code: 'AGRARIO',
    label: 'Banco Agrario',
    aliases: ['banco agrario', 'agrario'],
  },
  {
    code: 'SERFINANZA',
    label: 'Serfinanza',
    aliases: ['serfinanza'],
  },
  {
    code: 'BAN100',
    label: 'Ban100',
    aliases: ['ban100', 'ban 100'],
  },
  {
    code: 'IRIS',
    label: 'Iris',
    aliases: ['iris bank', 'banco iris', 'iris'],
  },
] as const;

export const PERSISTED_PROVIDER_CODES = [
  'NU',
  'LULO',
  'ICETEX',
  'BANCO_BOGOTA',
  'GENERIC',
] as const;

export type PersistedProviderCode = (typeof PERSISTED_PROVIDER_CODES)[number];

const ALIAS_INDEX: { alias: string; code: ColombianBankCode; label: string }[] =
  COLOMBIAN_BANKS.flatMap((entry) =>
    entry.aliases.map((alias) => ({
      alias,
      code: entry.code,
      label: entry.label,
    })),
  ).sort((a, b) => b.alias.length - a.alias.length);

const LABEL_BY_CODE = new Map<ColombianBankCode, string>(
  COLOMBIAN_BANKS.map((entry) => [entry.code, entry.label]),
);

export function bankLabel(code: ColombianBankCode): string {
  return LABEL_BY_CODE.get(code) ?? 'el banco';
}

export function toPersistedProvider(
  code: ColombianBankCode,
): PersistedProviderCode {
  if (
    code === 'NU' ||
    code === 'LULO' ||
    code === 'ICETEX' ||
    code === 'BANCO_BOGOTA' ||
    code === 'GENERIC'
  ) {
    return code;
  }
  return 'GENERIC';
}

export function matchColombianBank(
  foldedText: string,
): { code: ColombianBankCode; label: string } | null {
  for (const entry of ALIAS_INDEX) {
    if (foldedText.includes(entry.alias)) {
      return { code: entry.code, label: entry.label };
    }
  }
  return null;
}
