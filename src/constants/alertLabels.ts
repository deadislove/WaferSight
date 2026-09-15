import type { LiveAlert } from '../services/quality/alertsService';

export const SEVERITY_LABEL_KEY: Record<LiveAlert['severity'], string> = {
  info: 'severity.info',
  warning: 'severity.warning',
  critical: 'severity.critical',
};

export const SEVERITY_DOT: Record<LiveAlert['severity'], string> = {
  info: 'bg-slate-400',
  warning: 'bg-amber-400',
  critical: 'bg-red-400',
};

export const SEVERITY_TEXT: Record<LiveAlert['severity'], string> = {
  info: 'text-slate-300',
  warning: 'text-amber-300',
  critical: 'text-red-300',
};

export const SOURCE_LABEL_KEY: Record<LiveAlert['source'], string> = {
  spc: 'alertSource.spc',
  'defect-rate': 'alertSource.defect-rate',
  yield: 'alertSource.yield',
  system: 'alertSource.system',
};
