import React, { useState } from 'react';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Link as LinkIcon,
  Code,
  Heading2,
  Heading3,
  Heading4,
  List,
  ListOrdered,
  Quote,
  Image as ImageIcon,
  Table as TableIcon,
  Minus,
  AlertCircle,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Eye,
  Edit3,
  Sparkles,
  Info,
  CheckCircle,
  AlertTriangle,
} from 'lucide-react';
import { MediaLibraryModal } from './MediaLibraryModal';

export interface TextMark {
  type: 'bold' | 'italic' | 'underline' | 'strike' | 'link' | 'code';
  href?: string;
  target?: string;
}

export interface DocumentNode {
  id?: string;
  type:
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
  level?: 2 | 3 | 4 | 5 | 6;
  ordered?: boolean;
  align?: 'left' | 'center' | 'right' | 'justify';
  language?: string;
  url?: string;
  alt?: string;
  caption?: string;
  title?: string;
  text?: string;
  marks?: TextMark[];
  variant?: 'info' | 'warning' | 'success' | 'tip';
  children?: DocumentNode[];
}

export interface StructuredDocument {
  version: 1;
  type: 'doc';
  children: DocumentNode[];
}

interface RichTextEditorProps {
  value: StructuredDocument;
  onChange: (doc: StructuredDocument) => void;
}

export const RichTextEditor: React.FC<RichTextEditorProps> = ({ value, onChange }) => {
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit');
  const [mediaModalOpen, setMediaModalOpen] = useState(false);
  const [activeImageBlockIndex, setActiveImageBlockIndex] = useState<number | null>(null);

  const blocks = Array.isArray(value?.children) ? value.children : [];

  const updateBlocks = (newBlocks: DocumentNode[]) => {
    onChange({
      version: 1,
      type: 'doc',
      children: newBlocks,
    });
  };

  const addBlock = (type: DocumentNode['type'], extra?: Partial<DocumentNode>) => {
    let newBlock: DocumentNode;

    switch (type) {
      case 'heading':
        newBlock = { type: 'heading', level: extra?.level || 2, text: '' };
        break;
      case 'list':
        newBlock = {
          type: 'list',
          ordered: Boolean(extra?.ordered),
          children: [{ type: 'listItem', text: '' }],
        };
        break;
      case 'blockquote':
        newBlock = { type: 'blockquote', text: '' };
        break;
      case 'codeBlock':
        newBlock = { type: 'codeBlock', language: 'html', text: '' };
        break;
      case 'callout':
        newBlock = { type: 'callout', variant: 'tip', text: '' };
        break;
      case 'separator':
        newBlock = { type: 'separator' };
        break;
      case 'image':
        newBlock = { type: 'image', url: '', alt: '', caption: '', align: 'center' };
        break;
      case 'table':
        newBlock = {
          type: 'table',
          children: [
            {
              type: 'tableRow',
              children: [
                { type: 'tableCell', text: 'Header 1' },
                { type: 'tableCell', text: 'Header 2' },
              ],
            },
            {
              type: 'tableRow',
              children: [
                { type: 'tableCell', text: 'Data 1' },
                { type: 'tableCell', text: 'Data 2' },
              ],
            },
          ],
        };
        break;
      default:
        newBlock = { type: 'paragraph', text: '' };
    }

    updateBlocks([...blocks, newBlock]);
  };

  const updateBlock = (index: number, updates: Partial<DocumentNode>) => {
    const updated = [...blocks];
    updated[index] = { ...updated[index], ...updates };
    updateBlocks(updated);
  };

  const removeBlock = (index: number) => {
    const updated = blocks.filter((_, i) => i !== index);
    updateBlocks(updated);
  };

  const moveBlock = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === blocks.length - 1) return;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const updated = [...blocks];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;
    updateBlocks(updated);
  };

  const handleMediaSelected = (asset: any) => {
    if (activeImageBlockIndex !== null && blocks[activeImageBlockIndex]) {
      updateBlock(activeImageBlockIndex, {
        url: asset.publicUrl,
        alt: asset.altText || asset.title || asset.originalFilename,
        title: asset.title || asset.originalFilename,
      });
    } else {
      addBlock('image', {
        url: asset.publicUrl,
        alt: asset.altText || asset.title || asset.originalFilename,
        title: asset.title || asset.originalFilename,
      });
    }
    setActiveImageBlockIndex(null);
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden flex flex-col">
      {/* Editor Top Toolbar */}
      <div className="p-3 bg-zinc-950 border-b border-zinc-800 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mr-1">Add Block:</span>
          <button
            type="button"
            onClick={() => addBlock('paragraph')}
            className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-medium border border-zinc-800 transition-colors flex items-center gap-1.5"
          >
            <span>Paragraph</span>
          </button>
          <button
            type="button"
            onClick={() => addBlock('heading', { level: 2 })}
            className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-medium border border-zinc-800 transition-colors flex items-center gap-1"
          >
            <Heading2 className="w-3.5 h-3.5 text-blue-400" />
            <span>H2</span>
          </button>
          <button
            type="button"
            onClick={() => addBlock('heading', { level: 3 })}
            className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-medium border border-zinc-800 transition-colors flex items-center gap-1"
          >
            <Heading3 className="w-3.5 h-3.5 text-blue-400" />
            <span>H3</span>
          </button>
          <button
            type="button"
            onClick={() => addBlock('list', { ordered: false })}
            className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-medium border border-zinc-800 transition-colors flex items-center gap-1"
          >
            <List className="w-3.5 h-3.5 text-emerald-400" />
            <span>Bullets</span>
          </button>
          <button
            type="button"
            onClick={() => addBlock('list', { ordered: true })}
            className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-medium border border-zinc-800 transition-colors flex items-center gap-1"
          >
            <ListOrdered className="w-3.5 h-3.5 text-emerald-400" />
            <span>Numbered</span>
          </button>
          <button
            type="button"
            onClick={() => addBlock('blockquote')}
            className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-medium border border-zinc-800 transition-colors flex items-center gap-1"
          >
            <Quote className="w-3.5 h-3.5 text-purple-400" />
            <span>Quote</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveImageBlockIndex(null);
              setMediaModalOpen(true);
            }}
            className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-medium border border-zinc-800 transition-colors flex items-center gap-1"
          >
            <ImageIcon className="w-3.5 h-3.5 text-amber-400" />
            <span>Media</span>
          </button>
          <button
            type="button"
            onClick={() => addBlock('callout')}
            className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-medium border border-zinc-800 transition-colors flex items-center gap-1"
          >
            <AlertCircle className="w-3.5 h-3.5 text-cyan-400" />
            <span>Callout</span>
          </button>
          <button
            type="button"
            onClick={() => addBlock('codeBlock')}
            className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-medium border border-zinc-800 transition-colors flex items-center gap-1"
          >
            <Code className="w-3.5 h-3.5 text-rose-400" />
            <span>Code</span>
          </button>
          <button
            type="button"
            onClick={() => addBlock('separator')}
            className="px-2 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-medium border border-zinc-800 transition-colors flex items-center"
            title="Horizontal Divider"
          >
            <Minus className="w-3.5 h-3.5 text-zinc-500" />
          </button>
        </div>

        {/* Edit / Preview Toggle */}
        <div className="flex items-center bg-zinc-900 p-1 rounded-xl border border-zinc-800">
          <button
            type="button"
            onClick={() => setActiveTab('edit')}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
              activeTab === 'edit' ? 'bg-blue-600 text-white shadow-sm' : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Editor</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('preview')}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
              activeTab === 'preview' ? 'bg-blue-600 text-white shadow-sm' : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Live Preview</span>
          </button>
        </div>
      </div>

      {/* Editor Body */}
      <div className="p-5 flex-1 min-h-[400px]">
        {activeTab === 'edit' ? (
          <div className="space-y-4">
            {blocks.length === 0 ? (
              <div className="text-center py-16 text-zinc-500 border-2 border-dashed border-zinc-800 rounded-2xl">
                <Sparkles className="w-8 h-8 mx-auto mb-2 text-zinc-600 stroke-[1.2]" />
                <p className="text-xs font-medium text-zinc-400">Your article document is empty.</p>
                <p className="text-[11px] text-zinc-600 mt-1">Use the toolbar buttons above to add structured blocks.</p>
              </div>
            ) : (
              blocks.map((block, index) => (
                <div
                  key={index}
                  className="group relative bg-zinc-950 border border-zinc-800/90 hover:border-zinc-700 rounded-xl p-3.5 transition-all"
                >
                  {/* Block Header Toolbar */}
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-zinc-800/60 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] uppercase font-mono font-semibold px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-blue-400">
                        {block.type} {block.level ? `H${block.level}` : ''}
                      </span>
                      {block.type === 'callout' && (
                        <select
                          value={block.variant || 'tip'}
                          onChange={(e) => updateBlock(index, { variant: e.target.value as any })}
                          className="bg-zinc-900 border border-zinc-800 rounded px-2 py-0.5 text-[11px] text-zinc-300"
                        >
                          <option value="info">Info</option>
                          <option value="tip">Tip</option>
                          <option value="warning">Warning</option>
                          <option value="success">Success</option>
                        </select>
                      )}
                    </div>

                    <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={() => moveBlock(index, 'up')}
                        disabled={index === 0}
                        className="p-1 rounded text-zinc-500 hover:text-white disabled:opacity-30"
                        title="Move Up"
                      >
                        <ChevronUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveBlock(index, 'down')}
                        disabled={index === blocks.length - 1}
                        className="p-1 rounded text-zinc-500 hover:text-white disabled:opacity-30"
                        title="Move Down"
                      >
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeBlock(index)}
                        className="p-1 rounded text-zinc-500 hover:text-red-400"
                        title="Delete Block"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Block Specific Form Controls */}
                  {block.type === 'paragraph' && (
                    <textarea
                      rows={3}
                      value={block.text || ''}
                      onChange={(e) => updateBlock(index, { text: e.target.value })}
                      placeholder="Write your paragraph text here..."
                      className="w-full bg-transparent text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none resize-y leading-relaxed font-sans"
                    />
                  )}

                  {block.type === 'heading' && (
                    <input
                      type="text"
                      value={block.text || ''}
                      onChange={(e) => updateBlock(index, { text: e.target.value })}
                      placeholder={`Heading ${block.level || 2} title...`}
                      className="w-full bg-transparent text-base font-bold text-white placeholder-zinc-600 focus:outline-none"
                    />
                  )}

                  {block.type === 'blockquote' && (
                    <div className="border-l-2 border-purple-500 pl-3">
                      <textarea
                        rows={2}
                        value={block.text || ''}
                        onChange={(e) => updateBlock(index, { text: e.target.value })}
                        placeholder="Quotation or notable takeaway..."
                        className="w-full bg-transparent text-sm italic text-zinc-300 placeholder-zinc-600 focus:outline-none resize-y"
                      />
                    </div>
                  )}

                  {block.type === 'codeBlock' && (
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={block.language || ''}
                        onChange={(e) => updateBlock(index, { language: e.target.value })}
                        placeholder="Language (e.g. bash, javascript, python, json)"
                        className="bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-300 font-mono"
                      />
                      <textarea
                        rows={4}
                        value={block.text || ''}
                        onChange={(e) => updateBlock(index, { text: e.target.value })}
                        placeholder="Enter source code..."
                        className="w-full bg-zinc-900 p-3 rounded-lg text-xs font-mono text-emerald-400 placeholder-zinc-600 focus:outline-none"
                      />
                    </div>
                  )}

                  {block.type === 'callout' && (
                    <textarea
                      rows={2}
                      value={block.text || ''}
                      onChange={(e) => updateBlock(index, { text: e.target.value })}
                      placeholder="Callout tip or message..."
                      className="w-full bg-transparent text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none resize-y"
                    />
                  )}

                  {block.type === 'image' && (
                    <div className="space-y-3">
                      {block.url ? (
                        <div className="relative rounded-lg overflow-hidden border border-zinc-800 max-w-md mx-auto bg-zinc-900 p-2">
                          <img src={block.url} alt={block.alt || ''} className="max-h-52 mx-auto rounded object-contain" />
                          <button
                            type="button"
                            onClick={() => {
                              setActiveImageBlockIndex(index);
                              setMediaModalOpen(true);
                            }}
                            className="absolute bottom-3 right-3 px-2 py-1 bg-black/80 text-white rounded text-xs hover:bg-black"
                          >
                            Change Image
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setActiveImageBlockIndex(index);
                            setMediaModalOpen(true);
                          }}
                          className="w-full py-8 border-2 border-dashed border-zinc-800 rounded-xl flex flex-col items-center justify-center text-zinc-400 hover:text-white hover:border-zinc-700 transition-colors"
                        >
                          <ImageIcon className="w-8 h-8 mb-2 text-zinc-500" />
                          <span className="text-xs font-medium">Select Image from Media Library</span>
                        </button>
                      )}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <input
                          type="text"
                          value={block.alt || ''}
                          onChange={(e) => updateBlock(index, { alt: e.target.value })}
                          placeholder="Alt description (accessibility)..."
                          className="px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-300"
                        />
                        <input
                          type="text"
                          value={block.caption || ''}
                          onChange={(e) => updateBlock(index, { caption: e.target.value })}
                          placeholder="Caption (shown under image)..."
                          className="px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-300"
                        />
                      </div>
                    </div>
                  )}

                  {block.type === 'list' && (
                    <div className="space-y-2">
                      {(block.children || []).map((item, itemIdx) => (
                        <div key={itemIdx} className="flex items-center gap-2">
                          <span className="text-xs text-zinc-500 font-mono">{block.ordered ? `${itemIdx + 1}.` : '•'}</span>
                          <input
                            type="text"
                            value={item.text || ''}
                            onChange={(e) => {
                              const newChildren = [...(block.children || [])];
                              newChildren[itemIdx] = { ...newChildren[itemIdx], text: e.target.value };
                              updateBlock(index, { children: newChildren });
                            }}
                            placeholder="List item..."
                            className="flex-1 bg-transparent border-b border-zinc-800 pb-1 text-xs text-zinc-200 focus:outline-none focus:border-blue-500"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const newChildren = (block.children || []).filter((_, i) => i !== itemIdx);
                              updateBlock(index, { children: newChildren });
                            }}
                            className="text-zinc-600 hover:text-red-400 p-1"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => {
                          const newChildren = [...(block.children || []), { type: 'listItem', text: '' } as DocumentNode];
                          updateBlock(index, { children: newChildren });
                        }}
                        className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 pt-1"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Add Item</span>
                      </button>
                    </div>
                  )}

                  {block.type === 'separator' && (
                    <div className="py-2 text-center text-xs font-mono text-zinc-600">
                      ─── Horizontal Divider ───
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        ) : (
          /* Live Preview Tab */
          <div className="prose prose-invert max-w-none bg-zinc-950 p-6 rounded-xl border border-zinc-800 space-y-4">
            {blocks.map((block, i) => {
              if (block.type === 'paragraph') {
                return <p key={i} className="text-zinc-300 leading-relaxed text-sm md:text-base">{block.text}</p>;
              }
              if (block.type === 'heading') {
                const lvl = block.level || 2;
                if (lvl === 3) return <h3 key={i} className="text-xl font-bold text-white">{block.text}</h3>;
                if (lvl === 4) return <h4 key={i} className="text-lg font-bold text-white">{block.text}</h4>;
                return <h2 key={i} className="text-2xl font-bold text-white">{block.text}</h2>;
              }
              if (block.type === 'blockquote') {
                return (
                  <blockquote key={i} className="border-l-4 border-blue-500 bg-blue-950/20 pl-4 py-2 italic text-zinc-300 rounded-r">
                    {block.text}
                  </blockquote>
                );
              }
              if (block.type === 'codeBlock') {
                return (
                  <pre key={i} className="bg-zinc-900 p-4 rounded-xl text-xs font-mono text-emerald-400 overflow-x-auto">
                    <code>{block.text}</code>
                  </pre>
                );
              }
              if (block.type === 'callout') {
                return (
                  <div key={i} className="p-4 rounded-xl border-l-4 border-cyan-500 bg-cyan-950/30 text-cyan-200 text-sm">
                    {block.text}
                  </div>
                );
              }
              if (block.type === 'image') {
                return (
                  <figure key={i} className="my-4 text-center">
                    <img src={block.url} alt={block.alt || ''} className="rounded-xl max-h-80 mx-auto object-cover" />
                    {block.caption && <figcaption className="text-xs text-zinc-400 mt-2 italic">{block.caption}</figcaption>}
                  </figure>
                );
              }
              if (block.type === 'list') {
                const Tag = block.ordered ? 'ol' : 'ul';
                return (
                  <Tag key={i} className={`${block.ordered ? 'list-decimal' : 'list-disc'} ml-6 text-zinc-300 text-sm space-y-1`}>
                    {(block.children || []).map((c, ci) => (
                      <li key={ci}>{c.text}</li>
                    ))}
                  </Tag>
                );
              }
              if (block.type === 'separator') {
                return <hr key={i} className="border-t border-zinc-800 my-6" />;
              }
              return null;
            })}
          </div>
        )}
      </div>

      {/* Media Selector Modal */}
      <MediaLibraryModal
        isOpen={mediaModalOpen}
        onClose={() => setMediaModalOpen(false)}
        onSelect={handleMediaSelected}
        title="Insert Media Into Article"
      />
    </div>
  );
};
