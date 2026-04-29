import React from 'react';
import { Check } from 'lucide-react';

const STAGES = [
  { key: 'onboarding', label: 'Onboarding', labelHe: 'קליטה' },
  { key: 'chef_drafting', label: 'Chef Drafting', labelHe: 'הכנת תפריט' },
  { key: 'manager_review', label: 'Manager Review', labelHe: 'סקירת מנהל' },
  { key: 'client_approval', label: 'Client Approval', labelHe: 'אישור לקוח' },
  { key: 'finalized', label: 'Finalized', labelHe: 'מאושר' },
];

const STAGE_INDEX = Object.fromEntries(STAGES.map((s, i) => [s.key, i]));

export default function MenuProgressStepper({ stage, language = 'English' }) {
  const currentIdx = STAGE_INDEX[stage] ?? 0;

  return (
    <div className="flex items-center w-full overflow-x-auto pb-1">
      {STAGES.map((s, i) => {
        const done = i < currentIdx;
        const active = i === currentIdx;
        return (
          <React.Fragment key={s.key}>
            <div className="flex flex-col items-center flex-shrink-0">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                done ? 'bg-green-600 border-green-600 text-white' :
                active ? 'bg-white border-blue-600 text-blue-600' :
                'bg-gray-100 border-gray-300 text-gray-400'
              }`}>
                {done ? <Check className="w-4 h-4" /> : i + 1}
              </div>
              <span className={`text-xs mt-1 text-center whitespace-nowrap ${
                active ? 'text-blue-600 font-semibold' :
                done ? 'text-green-600' : 'text-gray-400'
              }`}>
                {language === 'Hebrew' ? s.labelHe : s.label}
              </span>
            </div>
            {i < STAGES.length - 1 && (
              <div className={`flex-1 h-0.5 mx-1 mb-4 ${done ? 'bg-green-500' : 'bg-gray-200'}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}