import React from 'react';
import { LeadProfile, ClientType } from '../types';

export const getTypeColor = (type: ClientType | string) => {
    switch(type) {
        case ClientType.BRAND: return 'bg-purple-100 text-purple-700';
        case ClientType.CONTRACTOR: return 'bg-orange-100 text-orange-700';
        case ClientType.WHOLESALER: return 'bg-green-100 text-green-700';
        default: return 'bg-gray-100 text-gray-700';
    }
};

interface LeadCardProps {
  lead: LeadProfile;
  isCompact?: boolean; // For sidebar view
  onSelect: (lead: LeadProfile) => void;
  onDelete?: (name: string) => void;
  onGenerateReport: (lead: LeadProfile) => void;
}

export const LeadCard: React.FC<LeadCardProps> = ({ 
  lead, 
  isCompact = false, 
  onSelect, 
  onDelete,
  onGenerateReport
}) => (
  <div className={`relative bg-white rounded-xl shadow-sm border transition-all overflow-hidden flex flex-col group
    ${isCompact ? 'border-slate-200 mb-3 hover:border-blue-300 hover:shadow-md' : 'border-blue-200 shadow-md ring-1 ring-blue-100'}
  `}>
    <div className={`${isCompact ? 'p-3' : 'p-5'} flex-1`}>
      <div className="flex justify-between items-start mb-2">
        <h4 className={`font-bold text-slate-900 truncate pr-2 w-full ${isCompact ? 'text-sm' : 'text-lg'}`} title={lead.companyName}>
          {lead.companyName}
        </h4>
        <div className="flex gap-2 shrink-0">
           <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${getTypeColor(lead.clientType)}`}>
            {lead.clientType}
           </span>
        </div>
      </div>
      
      {!isCompact && (
        <p className="text-slate-600 text-xs mb-3 line-clamp-2 h-8">{lead.summary}</p>
      )}
      
      <div className={`space-y-1 text-xs text-slate-500 ${isCompact ? 'mt-1' : 'border-t border-slate-100 pt-3'}`}>
        <div className="flex items-center gap-2">
          <span className="font-medium text-slate-700 w-10">Web:</span>
          <a href={lead.website} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline truncate flex-1">
            {lead.website}
          </a>
        </div>
        <div className="flex items-center gap-2">
           <span className="font-medium text-slate-700 w-10">Loc:</span>
           <span className="truncate flex-1">{lead.country}</span>
        </div>
      </div>
    </div>

    <div className={`bg-slate-50 border-t border-slate-200 flex justify-between items-center gap-2 ${isCompact ? 'px-3 py-2' : 'px-4 py-3'}`}>
       {onDelete && (
          <button 
            onClick={(e) => { e.stopPropagation(); onDelete(lead.companyName); }}
            className="text-slate-400 hover:text-red-500 text-xs font-medium px-1 opacity-0 group-hover:opacity-100 transition-opacity"
            title="Remove from library"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
          </button>
       )}
       
       <div className="ml-auto flex items-center gap-2">
        <button 
            onClick={(e) => { e.stopPropagation(); onGenerateReport(lead); }}
            className={`rounded-lg font-medium flex items-center gap-1 transition-colors bg-white border border-slate-300 text-slate-700 hover:text-blue-600 hover:border-blue-400
              ${isCompact ? 'px-2 py-1 text-[10px]' : 'px-3 py-1.5 text-xs'}
            `}
            title="Generate Deep Background Report (Chinese)"
          >
            <span>背调</span>
          </button>

         <button 
           onClick={() => onSelect(lead)}
           className={`rounded-lg font-medium flex items-center gap-1 transition-colors
             bg-primary text-white hover:bg-blue-600 shadow-sm
             ${isCompact ? 'px-2 py-1 text-[10px]' : 'px-3 py-1.5 text-xs'}
           `}
         >
           <span>Email</span>
         </button>
       </div>
    </div>
  </div>
);