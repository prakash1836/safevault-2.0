import type { DocCategory } from '../types';

export const CATEGORIES: { key: DocCategory; label: string; icon: string; color: string }[] = [
  { key: 'Insurance', label: 'Insurance', icon: 'ShieldCheck', color: '#4A7D6A' },
  { key: 'ID', label: 'Identity', icon: 'IdCard', color: '#1C3F3A' },
  { key: 'Health', label: 'Health', icon: 'HeartPulse', color: '#D16B54' },
  { key: 'Finance', label: 'Finance', icon: 'Landmark', color: '#DDA750' },
  { key: 'Education', label: 'Education', icon: 'GraduationCap', color: '#5C6A64' },
  { key: 'Property', label: 'Property', icon: 'Home', color: '#8A9A93' },
  { key: 'Vehicle', label: 'Vehicle', icon: 'Car', color: '#3B6655' },
  { key: 'Other', label: 'Other', icon: 'FileText', color: '#8A9A93' },
];

// Quick lookup for category colors/tints
export const CATEGORY_META: Record<DocCategory, { color: string; surface: string }> = {
  Insurance: { color: '#4A7D6A', surface: '#E5EFEA' },
  ID: { color: '#1C3F3A', surface: '#E0EBE8' },
  Health: { color: '#D16B54', surface: '#F8E3DC' },
  Finance: { color: '#DDA750', surface: '#FBF1DE' },
  Education: { color: '#5C6A64', surface: '#ECEEED' },
  Property: { color: '#8A9A93', surface: '#EEF2F0' },
  Vehicle: { color: '#3B6655', surface: '#E5EFEA' },
  Other: { color: '#8A9A93', surface: '#EEF2F0' },
};

export const SUGGESTED_DOCS = [
  'Passport',
  'Aadhaar / National ID',
  'Driving License',
  'Health Insurance',
  'Life Insurance',
  'Birth Certificate',
  'Marriage Certificate',
  'Property Deed',
  'Vehicle Registration',
  'PAN / Tax ID',
];
