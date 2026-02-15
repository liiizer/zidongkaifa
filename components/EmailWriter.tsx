import React, { useState } from 'react';
import { generateColdEmail } from '../services/qwenService'; // Switched to Qwen
import { LeadProfile, BackgroundReport } from '../types';

interface EmailWriterProps {
  currentLead: LeadProfile | null;
  backgroundReport: BackgroundReport | null;
  draft: { subject: string; body: string };
  onUpdateDraft: (draft: { subject: string; body: string }) => void;
}

const EmailWriter: React.FC<EmailWriterProps> = ({ currentLead, backgroundReport, draft, onUpdateDraft }) => {
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    if (!currentLead) return;
    setLoading(true);
    try {
      // Pass the background report if available to create a targeted email
      const result = await generateColdEmail(currentLead, backgroundReport || undefined);
      // Update parent state directly
      onUpdateDraft({ subject: result.subject, body: result.body });
    } catch (error) {
      console.error(error);
      alert("Failed to generate email. Please check your API key or connection.");
    } finally {
      setLoading(false);
    }
  };

  if (!currentLead) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-slate-400">
        <svg className="w-16 h-16 mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
        <p>Please analyze a lead in the 'Lead Scout' tab first.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
       <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold text-slate-900">Email Writer</h2>
          <div className="text-slate-500 mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm">
            <span>Targeting: <span className="font-semibold text-primary">{currentLead.companyName}</span></span>
            <span>Type: {currentLead.clientType}</span>
            <span>Lang: {currentLead.language}</span>
          </div>
          {backgroundReport && (
             <div className="mt-2 inline-flex items-center gap-2 bg-purple-50 text-purple-700 px-3 py-1 rounded-full text-xs font-medium border border-purple-100">
               <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
               Using Deep Background Intel (Strategy: {backgroundReport.cooperationSuggestion.slice(0, 30)}...)
             </div>
          )}
        </div>
        <button
          onClick={handleGenerate}
          disabled={loading}
          className="bg-primary hover:bg-blue-600 text-white px-5 py-2.5 rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-blue-200"
        >
          {loading ? (
             <>
               <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                 <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                 <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
               </svg>
               Drafting with AI...
             </>
          ) : (
            <>
               <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
               Generate Draft
            </>
          )}
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-[600px]">
        <div className="border-b border-slate-200 p-4 bg-slate-50 flex items-center gap-4">
           <span className="text-slate-500 font-medium">Subject:</span>
           <input 
             type="text" 
             value={draft.subject}
             onChange={(e) => onUpdateDraft({ ...draft, subject: e.target.value })}
             className="flex-1 bg-transparent border-none focus:ring-0 text-slate-900 font-medium placeholder-slate-400"
             placeholder={loading ? "Generating subject..." : "Email subject line..."}
           />
        </div>
        <div className="flex-1 p-4">
          <textarea
            value={draft.body}
            onChange={(e) => onUpdateDraft({ ...draft, body: e.target.value })}
            className="w-full h-full resize-none border-none focus:ring-0 text-slate-700 leading-relaxed text-lg font-sans"
            placeholder={loading ? "AI is analyzing company data and writing your email..." : "Email content will appear here..."}
          />
        </div>
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-3">
          <button 
            className="px-4 py-2 text-slate-600 hover:text-slate-900 font-medium"
            onClick={() => {
              onUpdateDraft({ subject: '', body: '' });
            }}
          >
            Clear
          </button>
          <button 
            className="bg-slate-900 text-white px-6 py-2 rounded-lg hover:bg-slate-800 transition-colors flex items-center gap-2"
            onClick={() => {
              navigator.clipboard.writeText(`${draft.subject}\n\n${draft.body}`);
              alert("Copied to clipboard!");
            }}
          >
             <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"></path></svg>
             Copy
          </button>
        </div>
      </div>
    </div>
  );
};

export default EmailWriter;