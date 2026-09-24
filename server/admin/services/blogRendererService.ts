/**
 * Safe Structured Document to HTML Renderer for Phase 8.4 Blog CMS
 */

import { DocumentNode, StructuredDocument, TextMark } from '../models/blogDocumentTypes.js';

export class BlogRendererService {
  /**
   * Converts StructuredDocument AST safely to validated HTML
   */
  public static renderDocumentToHtml(doc: StructuredDocument): string {
    if (!doc || !Array.isArray(doc.children)) {
      return '';
    }

    const htmlParts: string[] = [];
    for (const child of doc.children) {
      htmlParts.push(this.renderNode(child));
    }

    return htmlParts.filter(Boolean).join('\n');
  }

  /**
   * Renders individual AST node
   */
  public static renderNode(node: DocumentNode): string {
    if (!node || !node.type) return '';

    switch (node.type) {
      case 'paragraph': {
        const content = this.renderChildrenOrText(node);
        const alignClass = this.getAlignClass(node.align);
        const className = `cms-paragraph text-slate-700 dark:text-slate-300 leading-relaxed my-4 text-base md:text-lg ${alignClass}`.trim();
        return `<p class="${className}">${content}</p>`;
      }

      case 'heading': {
        const level = node.level && [2, 3, 4, 5, 6].includes(node.level) ? node.level : 2;
        const tag = `h${level}`;
        const content = this.renderChildrenOrText(node);
        const alignClass = this.getAlignClass(node.align);
        const sizeClasses: Record<number, string> = {
          2: 'text-2xl md:text-3xl font-bold mt-8 mb-4 text-slate-900 dark:text-white',
          3: 'text-xl md:text-2xl font-bold mt-6 mb-3 text-slate-900 dark:text-white',
          4: 'text-lg md:text-xl font-semibold mt-5 mb-2 text-slate-900 dark:text-white',
          5: 'text-base md:text-lg font-semibold mt-4 mb-2 text-slate-900 dark:text-white',
          6: 'text-sm md:text-base font-semibold mt-4 mb-1 text-slate-800 dark:text-slate-200 uppercase tracking-wider',
        };
        const className = `cms-heading ${sizeClasses[level] || sizeClasses[2]} ${alignClass}`.trim();
        return `<${tag} class="${className}">${content}</${tag}>`;
      }

      case 'list': {
        const isOrdered = Boolean(node.ordered);
        const tag = isOrdered ? 'ol' : 'ul';
        const listClass = isOrdered ? 'list-decimal' : 'list-disc';
        const className = `cms-list ${listClass} ml-6 my-4 space-y-2 text-slate-700 dark:text-slate-300`;
        const inner = (node.children || []).map((c) => this.renderNode(c)).join('\n');
        return `<${tag} class="${className}">${inner}</${tag}>`;
      }

      case 'listItem': {
        const content = this.renderChildrenOrText(node);
        return `<li class="cms-list-item pl-1">${content}</li>`;
      }

      case 'blockquote': {
        const content = this.renderChildrenOrText(node);
        return `<blockquote class="cms-blockquote border-l-4 border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 pl-4 py-3 my-5 rounded-r-lg text-slate-800 dark:text-slate-200 italic font-medium">${content}</blockquote>`;
      }

      case 'codeBlock': {
        const codeText = this.escapeHtml(node.text || '');
        const lang = node.language ? this.escapeHtml(node.language) : '';
        return `<pre class="cms-code-block bg-slate-900 text-slate-100 p-4 rounded-xl my-5 overflow-x-auto text-sm font-mono border border-slate-800"><code${lang ? ` class="language-${lang}"` : ''}>${codeText}</code></pre>`;
      }

      case 'image': {
        const safeUrl = this.sanitizeUrl(node.url || '');
        if (!safeUrl) return '';

        const alt = this.escapeHtml(node.alt || '');
        const caption = node.caption ? this.escapeHtml(node.caption) : '';
        const title = node.title ? this.escapeHtml(node.title) : '';
        const alignClass = this.getImageAlignClass(node.align);

        let imgTag = `<img src="${safeUrl}" alt="${alt}"${title ? ` title="${title}"` : ''} class="rounded-xl shadow-md max-w-full h-auto object-cover mx-auto" loading="lazy" />`;

        if (caption) {
          return `<figure class="cms-figure my-6 ${alignClass}">${imgTag}<figcaption class="text-center text-xs md:text-sm text-slate-500 dark:text-slate-400 mt-2 italic">${caption}</figcaption></figure>`;
        }
        return `<div class="cms-image-wrapper my-6 ${alignClass}">${imgTag}</div>`;
      }

      case 'table': {
        const rows = (node.children || []).map((r) => this.renderNode(r)).join('\n');
        return `<div class="cms-table-wrapper overflow-x-auto my-6"><table class="cms-table w-full border-collapse border border-slate-200 dark:border-slate-800 text-left text-sm rounded-lg overflow-hidden">${rows}</table></div>`;
      }

      case 'tableRow': {
        const cells = (node.children || []).map((c) => this.renderNode(c)).join('');
        return `<tr class="border-b border-slate-200 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-colors">${cells}</tr>`;
      }

      case 'tableCell': {
        const content = this.renderChildrenOrText(node);
        return `<td class="p-3 border-r border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300">${content}</td>`;
      }

      case 'separator': {
        return `<hr class="cms-separator border-t border-slate-200 dark:border-slate-800 my-8" />`;
      }

      case 'callout': {
        const content = this.renderChildrenOrText(node);
        const variant = node.variant || 'info';
        const styles: Record<string, string> = {
          info: 'bg-blue-50/80 dark:bg-blue-950/30 border-blue-500 text-blue-900 dark:text-blue-100',
          warning: 'bg-amber-50/80 dark:bg-amber-950/30 border-amber-500 text-amber-900 dark:text-amber-100',
          success: 'bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-500 text-emerald-900 dark:text-emerald-100',
          tip: 'bg-purple-50/80 dark:bg-purple-950/30 border-purple-500 text-purple-900 dark:text-purple-100',
        };
        const currentStyle = styles[variant] || styles.info;
        return `<div class="cms-callout border-l-4 p-4 rounded-r-xl my-5 ${currentStyle}">${content}</div>`;
      }

      default:
        return '';
    }
  }

  /**
   * Renders either text with marks or nested children
   */
  private static renderChildrenOrText(node: DocumentNode): string {
    if (node.text !== undefined) {
      return this.applyMarks(this.escapeHtml(node.text), node.marks || []);
    }

    if (Array.isArray(node.children)) {
      return node.children.map((c) => this.renderChildrenOrText(c)).join('');
    }

    return '';
  }

  /**
   * Applies text marks (bold, italic, strike, link, code)
   */
  private static applyMarks(text: string, marks: TextMark[]): string {
    let result = text;
    for (const mark of marks) {
      switch (mark.type) {
        case 'bold':
          result = `<strong class="font-bold text-slate-900 dark:text-white">${result}</strong>`;
          break;
        case 'italic':
          result = `<em class="italic">${result}</em>`;
          break;
        case 'underline':
          result = `<u class="underline underline-offset-2">${result}</u>`;
          break;
        case 'strike':
          result = `<s class="line-through text-slate-400">${result}</s>`;
          break;
        case 'code':
          result = `<code class="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 font-mono text-sm">${result}</code>`;
          break;
        case 'link': {
          const safeHref = this.sanitizeUrl(mark.href || '');
          if (safeHref) {
            result = `<a href="${safeHref}" class="text-emerald-600 dark:text-emerald-400 underline underline-offset-2 hover:text-emerald-700 dark:hover:text-emerald-300 font-medium transition-colors" target="${mark.target === '_blank' ? '_blank' : '_self'}" rel="noopener noreferrer">${result}</a>`;
          }
          break;
        }
      }
    }
    return result;
  }

  /**
   * URL sanitization: strictly permits only safe protocols (http, https, relative path)
   * Rejects javascript:, data:, vbscript:, etc.
   */
  public static sanitizeUrl(url: string): string {
    if (!url || typeof url !== 'string') return '';
    const trimmed = url.trim();

    // Internal relative links are safe
    if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
      return trimmed;
    }

    // Absolute URLs: verify protocol
    try {
      const parsed = new URL(trimmed, 'https://example.com');
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        return trimmed;
      }
    } catch {
      // ignore
    }

    return '';
  }

  /**
   * Strict HTML entity escaping
   */
  public static escapeHtml(text: string): string {
    if (!text || typeof text !== 'string') return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  private static getAlignClass(align?: string): string {
    if (align === 'center') return 'text-center';
    if (align === 'right') return 'text-right';
    if (align === 'justify') return 'text-justify';
    return 'text-left';
  }

  private static getImageAlignClass(align?: string): string {
    if (align === 'left') return 'mr-auto';
    if (align === 'right') return 'ml-auto';
    return 'mx-auto';
  }
}
