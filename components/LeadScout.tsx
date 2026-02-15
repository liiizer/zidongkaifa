import React, { useState } from 'react';
import { analyzeLead, findLeads } from '../services/qwenService'; // Switched to Qwen
import { storageService } from '../services/storageService'; 
import { LeadProfile } from '../types';
import { LeadCard } from './LeadCard';

interface LeadScoutProps {
  onLeadFound: (lead: LeadProfile) => void;
  savedState: { query: string; leads: LeadProfile[] };
  onSaveState: (state: { query: string; leads: LeadProfile[] }) => void;
  onRefreshHistory: () => void; // Trigger sidebar update
  onGenerateReport: (lead: LeadProfile) => void; // Delegate to App
}

const LeadScout: React.FC<LeadScoutProps> = ({ 
  onLeadFound, 
  savedState, 
  onSaveState, 
  onRefreshHistory,
  onGenerateReport
}) => {
  const [input, setInput] = useState(savedState.query || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInput(val);
    onSaveState({ ...savedState, query: val });
  };

  const handleSearch = async () => {
    if (!input) return;
    setLoading(true);
    setError(null);
    onSaveState({ ...savedState, leads: [] }); 

    try {
      // Get current exclusion list from storage (Async now)
      const currentHistory = await storageService.getLeads();
      const existingNames = currentHistory.map(l => l.companyName);

      const isUrl = input.includes('.') || input.includes('http');
      let newLeads: LeadProfile[] = [];

      if (isUrl) {
        const data = await analyzeLead(input);
        newLeads = [data];
      } else {
        newLeads = await findLeads(input, existingNames);
      }

      if (newLeads.length > 0) {
        // Save to persistent storage immediately (Async)
        await storageService.saveLeads(newLeads);
        
        // Notify App to update sidebar
        onRefreshHistory();
        
        // Show in "Current Results"
        onSaveState({ ...savedState, leads: newLeads });

        if (isUrl) {
          onLeadFound(newLeads[0]);
        }
      } else {
        setError("No new leads found. Try a different region or keyword.");
      }

    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to scout leads. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-8">
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-bold text-slate-900">Global Market Scout</h2>
        <p className="text-slate-500">Search for "Bathroom Distributors in Germany" or analyze a specific URL.</p>
      </div>

      {/* Search Input */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 max-w-2xl mx-auto">
        <div className="flex gap-2">
          <input
            type="text"
            className="flex-1 p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-lg"
            placeholder="Region (e.g. Texas) or Website URL..."
            value={input}
            onChange={handleInputChange}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
          <button
            onClick={handleSearch}
            disabled={loading}
            className="bg-primary hover:bg-blue-600 text-white px-8 py-3 rounded-lg font-bold transition-colors disabled:opacity-50 flex items-center gap-2 whitespace-nowrap min-w-[140px] justify-center"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Scouting...
              </>
            ) : (
              'Search'
            )}
          </button>
        </div>
        {error && <p className="text-red-500 mt-2 text-sm text-center">{error}</p>}
      </div>

      {/* Section: New Results */}
      {savedState.leads.length > 0 && (
        <div className="space-y-4 animate-fade-in mb-10">
          <div className="flex items-center justify-between">
             <h3 className="text-lg font-bold text-primary flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
              New Findings
             </h3>
             <span className="text-xs text-slate-400">Successfully added to library</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {savedState.leads.map((lead, idx) => (
              <LeadCard 
                key={`new-${idx}`} 
                lead={lead} 
                isCompact={false}
                onSelect={onLeadFound}
                onGenerateReport={onGenerateReport}
              />
            ))}
          </div>
        </div>
      )}

      {/* Empty State Hint */}
      {savedState.leads.length === 0 && !loading && (
        <div className="text-center py-20 opacity-50">
          <svg className="w-16 h-16 mx-auto text-slate-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
          <p className="text-lg font-medium text-slate-400">Check the sidebar for your Leads Library.</p>
        </div>
      )}
    </div>
  );
};

export default LeadScout;