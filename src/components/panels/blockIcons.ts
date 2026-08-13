import React from 'react';
import {
  AlignLeft,
  Code,
  Columns2,
  Columns3,
  Image,
  List,
  Minus,
  MousePointerClick,
  MoveVertical,
  Quote,
  Rows3,
  Square,
  Type,
} from 'lucide-react';
import { ElementType, EmailElement } from '../../types';

export type BlockIcon = React.ComponentType<{ className?: string }>;

/**
 * The icon each column count wears — the palette's three structural cards, and
 * what a row shows in the Sections outline so a "2 Columns" block is the same
 * picture wherever it appears.
 */
export const COLUMN_ICONS: Record<number, BlockIcon> = {
  1: Square,
  2: Columns2,
  3: Columns3,
};

/**
 * One icon per block type, read by the palette and the Sections outline.
 *
 * Same reasoning as `TYPE_LABELS`: a block shouldn't wear one picture in the
 * palette and a different one in the outline.
 */
export const BLOCK_ICONS: Record<ElementType, BlockIcon> = {
  section: Rows3,
  row: Columns3,
  column: Square,
  image: Image,
  heading: Type,
  paragraph: AlignLeft,
  list: List,
  button: MousePointerClick,
  divider: Minus,
  spacer: MoveVertical,
  quote: Quote,
  'custom-html': Code,
};

/**
 * What *this* block looks like. A row is drawn by its column count, since
 * that's the difference the author actually chose in the palette.
 */
export function blockIcon(el: EmailElement): BlockIcon {
  if (el.type === 'row') {
    return COLUMN_ICONS[(el.childElements || []).length] ?? Columns3;
  }
  return BLOCK_ICONS[el.type] ?? Square;
}
