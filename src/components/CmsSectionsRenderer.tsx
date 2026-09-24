import React, { useState } from 'react';
import {
  Sparkles,
  Shield,
  Zap,
  CheckCircle2,
  HelpCircle,
  ChevronDown,
  ArrowRight,
  ExternalLink,
  Layers,
  FileText,
} from 'lucide-react';

export interface CmsSectionItem {
  id: string;
  sectionType: 'hero' | 'rich_text' | 'feature_grid' | 'how_to' | 'faq' | 'cta' | 'related_tools';
  sortOrder: number;
  data: any;
  isVisible: boolean;
}

interface CmsSectionsRendererProps {
  sections: CmsSectionItem[];
  onNavigate?: (path: string) => void;
  excludeHero?: boolean;
}

export const CmsSectionsRenderer: React.FC<CmsSectionsRendererProps> = ({
  sections,
  onNavigate,
  excludeHero = false,
}) => {
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

  const sorted = [...sections]
    .filter((s) => s.isVisible !== false)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const filtered = excludeHero ? sorted.filter((s) => s.sectionType !== 'hero') : sorted;

  return (
    <div className="space-y-12">
      {filtered.map((section) => {
        switch (section.sectionType) {
          case 'hero': {
            const data = section.data || {};
            const alignClass = data.alignment === 'left' ? 'text-left' : 'text-center';
            return (
              <div key={section.id} className={`py-6 ${alignClass} space-y-3`}>
                {data.eyebrow && (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{data.eyebrow}</span>
                  </div>
                )}
                <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-white">
                  {data.heading}
                </h1>
                <p className="text-slate-400 max-w-2xl mx-auto text-sm sm:text-base leading-relaxed">
                  {data.description}
                </p>
                {(data.primaryCta || data.secondaryCta) && (
                  <div className="pt-4 flex flex-wrap items-center justify-center gap-3">
                    {data.primaryCta && (
                      <a
                        href={data.primaryCta.url}
                        onClick={(e) => {
                          if (data.primaryCta.url.startsWith('/') && onNavigate) {
                            e.preventDefault();
                            onNavigate(data.primaryCta.url);
                          }
                        }}
                        className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-semibold text-xs text-white transition-colors flex items-center gap-1.5"
                      >
                        <span>{data.primaryCta.label}</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </a>
                    )}
                    {data.secondaryCta && (
                      <a
                        href={data.secondaryCta.url}
                        onClick={(e) => {
                          if (data.secondaryCta.url.startsWith('/') && onNavigate) {
                            e.preventDefault();
                            onNavigate(data.secondaryCta.url);
                          }
                        }}
                        className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 font-medium text-xs text-slate-200 transition-colors"
                      >
                        {data.secondaryCta.label}
                      </a>
                    )}
                  </div>
                )}
              </div>
            );
          }

          case 'feature_grid': {
            const data = section.data || {};
            const features = Array.isArray(data.features) ? data.features : [];
            return (
              <section key={section.id} className="space-y-6 pt-4">
                <div className="text-center space-y-2">
                  <h2 className="text-2xl font-bold text-white tracking-tight">{data.heading}</h2>
                  {data.description && (
                    <p className="text-xs sm:text-sm text-slate-400 max-w-xl mx-auto">
                      {data.description}
                    </p>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pt-2">
                  {features.map((feat: any, idx: number) => (
                    <div
                      key={idx}
                      className="p-5 rounded-2xl bg-slate-900/50 border border-slate-800/80 hover:border-slate-700/80 transition-all space-y-2.5"
                    >
                      <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
                        <Zap className="w-4 h-4" />
                      </div>
                      <h3 className="font-semibold text-sm text-white">{feat.title}</h3>
                      <p className="text-xs text-slate-400 leading-relaxed">{feat.description}</p>
                    </div>
                  ))}
                </div>
              </section>
            );
          }

          case 'how_to': {
            const data = section.data || {};
            const steps = Array.isArray(data.steps) ? data.steps : [];
            return (
              <section key={section.id} className="space-y-6 pt-4">
                <div className="text-center space-y-2">
                  <h2 className="text-2xl font-bold text-white tracking-tight">{data.heading}</h2>
                  {data.description && (
                    <p className="text-xs sm:text-sm text-slate-400 max-w-xl mx-auto">
                      {data.description}
                    </p>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                  {steps.map((step: any, idx: number) => (
                    <div
                      key={idx}
                      className="p-5 rounded-2xl bg-slate-900/50 border border-slate-800/80 space-y-3 relative overflow-hidden"
                    >
                      <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white font-bold flex items-center justify-center text-xs shadow-md shadow-indigo-600/30">
                        {step.stepNumber || idx + 1}
                      </div>
                      <h3 className="font-semibold text-sm text-white">{step.title}</h3>
                      <p className="text-xs text-slate-400 leading-relaxed">{step.description}</p>
                    </div>
                  ))}
                </div>
              </section>
            );
          }

          case 'faq': {
            const data = section.data || {};
            const items = Array.isArray(data.items) ? data.items : [];
            return (
              <section
                key={section.id}
                className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-6 sm:p-8 space-y-6"
              >
                <div className="space-y-1">
                  <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-400">
                    <HelpCircle className="w-4 h-4" />
                    <span>Frequently Asked Questions</span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-bold text-white">
                    {data.heading || 'Frequently Asked Questions'}
                  </h2>
                  {data.description && (
                    <p className="text-xs text-slate-400">{data.description}</p>
                  )}
                </div>
                <div className="space-y-3 pt-2">
                  {items.map((item: any, idx: number) => {
                    const isOpen = openFaqIndex === idx;
                    return (
                      <div
                        key={idx}
                        className="rounded-xl border border-slate-800/80 bg-slate-950/40 overflow-hidden transition-colors"
                      >
                        <button
                          type="button"
                          onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                          className="w-full text-left px-4 py-3.5 flex items-center justify-between gap-3 hover:bg-slate-800/30 transition-colors"
                        >
                          <span className="font-medium text-xs sm:text-sm text-slate-200">
                            {item.question}
                          </span>
                          <ChevronDown
                            className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${
                              isOpen ? 'rotate-180 text-indigo-400' : ''
                            }`}
                          />
                        </button>
                        {isOpen && (
                          <div className="px-4 pb-4 pt-1 text-xs text-slate-400 leading-relaxed border-t border-slate-800/40">
                            {item.answer}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          }

          case 'rich_text': {
            const data = section.data || {};
            return (
              <section
                key={section.id}
                className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-6 sm:p-8 space-y-4"
              >
                {data.heading && (
                  <h2 className="text-xl sm:text-2xl font-bold text-white">{data.heading}</h2>
                )}
                {data.subheading && (
                  <h3 className="text-sm font-semibold text-indigo-400">{data.subheading}</h3>
                )}
                <div className="text-xs sm:text-sm text-slate-300 leading-relaxed space-y-3 whitespace-pre-line">
                  {data.content}
                </div>
              </section>
            );
          }

          case 'cta': {
            const data = section.data || {};
            return (
              <section
                key={section.id}
                className="p-8 sm:p-10 rounded-2xl bg-gradient-to-r from-indigo-950/80 via-slate-900 to-indigo-950/60 border border-indigo-500/30 text-center space-y-4 shadow-xl shadow-indigo-950/20"
              >
                <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                  {data.heading}
                </h2>
                <p className="text-xs sm:text-sm text-slate-300 max-w-xl mx-auto leading-relaxed">
                  {data.description}
                </p>
                <div className="pt-2">
                  <a
                    href={data.buttonUrl}
                    onClick={(e) => {
                      if (data.buttonUrl?.startsWith('/') && onNavigate) {
                        e.preventDefault();
                        onNavigate(data.buttonUrl);
                      }
                    }}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-lg shadow-indigo-600/30 transition-all hover:scale-[1.02]"
                  >
                    <span>{data.buttonLabel}</span>
                    <ArrowRight className="w-4 h-4" />
                  </a>
                </div>
              </section>
            );
          }

          case 'related_tools': {
            const data = section.data || {};
            const tools = Array.isArray(data.tools) ? data.tools : [];
            return (
              <section
                key={section.id}
                className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800/80 space-y-4"
              >
                <div className="space-y-1">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    {data.heading || 'Related Free Download Tools'}
                  </h3>
                  {data.description && (
                    <p className="text-xs text-slate-400">{data.description}</p>
                  )}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5 pt-1">
                  {tools.map((tool: any, idx: number) => (
                    <a
                      key={idx}
                      href={tool.route}
                      onClick={(e) => {
                        if (tool.route?.startsWith('/') && onNavigate) {
                          e.preventDefault();
                          onNavigate(tool.route);
                        }
                      }}
                      className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 hover:border-indigo-500/40 hover:bg-slate-900 transition-all text-center flex flex-col items-center justify-center gap-1.5 group"
                    >
                      <Layers className="w-4 h-4 text-slate-400 group-hover:text-indigo-400 transition-colors" />
                      <span className="text-xs font-medium text-slate-300 group-hover:text-white transition-colors truncate w-full">
                        {tool.label}
                      </span>
                    </a>
                  ))}
                </div>
              </section>
            );
          }

          default:
            return null;
        }
      })}
    </div>
  );
};
