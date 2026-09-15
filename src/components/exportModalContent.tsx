// src/components/ExportModalContent.tsx
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

export type ExportFormat = 'csv' | 'pdf' | 'xml';

interface ExportModalContentProps {
  onConfirm: (format: ExportFormat) => void;
  onCancel: () => void;
}

export default function ExportModalContent({ onConfirm, onCancel }: ExportModalContentProps) {
  const { t } = useTranslation();
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('csv');

  const options: { key: ExportFormat; label: string; desc: string; icon: string }[] = [
    { key: 'csv', label: t('exportModal.csvLabel'), desc: t('exportModal.csvDesc'), icon: '📊' },
    { key: 'pdf', label: t('exportModal.pdfLabel'), desc: t('exportModal.pdfDesc'), icon: '📄' },
    { key: 'xml', label: t('exportModal.xmlLabel'), desc: t('exportModal.xmlDesc'), icon: '⚙️' },
  ];

  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-400">{t('exportModal.prompt')}</p>

      <div className="space-y-3">
        {options.map((opt) => (
          <label
            key={opt.key}
            onClick={() => setSelectedFormat(opt.key)}
            className={`flex items-start gap-4 p-3.5 rounded-xl border cursor-pointer transition ${
              selectedFormat === opt.key
                ? 'bg-purple-600/10 border-purple-500 text-white'
                : 'bg-slate-900/40 border-slate-700/60 text-slate-300 hover:border-slate-500'
            }`}
          >
            <input
              type="radio"
              name="export-format"
              value={opt.key}
              checked={selectedFormat === opt.key}
              onChange={() => setSelectedFormat(opt.key)}
              className="mt-1 text-purple-600 focus:ring-purple-500"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2 font-medium">
                <span>{opt.icon}</span>
                <span>{opt.label}</span>
              </div>
              <p className="text-xs text-slate-400 mt-1">{opt.desc}</p>
            </div>
          </label>
        ))}
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <button
          onClick={onCancel}
          className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-medium transition"
        >
          {t('common.cancel')}
        </button>
        <button
          onClick={() => onConfirm(selectedFormat)}
          className="px-5 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium shadow-lg shadow-purple-600/30 transition"
        >
          {t('exportModal.confirmExport')}
        </button>
      </div>
    </div>
  );
}