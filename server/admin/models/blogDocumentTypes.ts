/**
 * Structured Document Model for Phase 8.4 Advanced Editor
 */

export type DocumentNodeType =
  | 'doc'
  | 'paragraph'
  | 'heading'
  | 'list'
  | 'listItem'
  | 'blockquote'
  | 'codeBlock'
  | 'image'
  | 'table'
  | 'tableRow'
  | 'tableCell'
  | 'separator'
  | 'callout';

export type TextMarkType = 'bold' | 'italic' | 'underline' | 'strike' | 'link' | 'code';

export interface TextMark {
  type: TextMarkType;
  href?: string;
  target?: string;
}

export interface DocumentNode {
  id?: string;
  type: DocumentNodeType;
  level?: 2 | 3 | 4 | 5 | 6; // H2 to H6 (H1 is reserved for the article title)
  ordered?: boolean;
  align?: 'left' | 'center' | 'right' | 'justify';
  language?: string;
  url?: string;
  alt?: string;
  caption?: string;
  title?: string;
  width?: number | null;
  height?: number | null;
  text?: string;
  marks?: TextMark[];
  variant?: 'info' | 'warning' | 'success' | 'tip'; // For callouts
  children?: DocumentNode[];
}

export interface StructuredDocument {
  version: 1;
  type: 'doc';
  children: DocumentNode[];
}
