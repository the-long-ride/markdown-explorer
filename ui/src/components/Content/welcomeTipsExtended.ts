import type { TipItem } from './welcomeTipsContent';
import { EXTENDED_TIPS_PART_A } from './welcomeTipsExtendedA';
import { EXTENDED_TIPS_PART_B } from './welcomeTipsExtendedB';
import { EXTENDED_TIPS_PART_C } from './welcomeTipsExtendedC';

export const EXTENDED_TIPS_CONTENT: Record<string, Record<string, TipItem>> = {
  ...EXTENDED_TIPS_PART_A,
  ...EXTENDED_TIPS_PART_B,
  ...EXTENDED_TIPS_PART_C,
};
