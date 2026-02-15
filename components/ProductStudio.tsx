import React, { useState, useRef } from 'react';
import { generateProductScene } from '../services/qwenService'; // Switched to Qwen

const ProductStudio: React.FC = () => {
  const [sourceImage, setSourceImage] = useState<string | null>(null);
  const [generatedImages, setGeneratedImages] = useState<{type: string, url: string}[]>([]);
  const [loading, setLoading] = useState<string | null>(null); // contains type of image loading
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSourceImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const generateSet = async () => {
    if (!sourceImage) return;
    
    // Clean base64 string
    const base64Data = sourceImage.split(',')[1];
    const types: ('Main' | 'Detail' | '3D Render')[] = ['Main', 'Detail', '3D Render'];
    
    // We generate sequentially to avoid rate limits and better UX feedback
    for (const type of types) {
      setLoading(type);
      try {
        const newImageUrl = await generateProductScene(base64Data, type);
        setGeneratedImages(prev => [...prev, { type, url: newImageUrl }]);
      } catch (error) {
        console.error(`Failed to generate ${type}`, error);
      }
    }
    setLoading(null);
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="text-center mb-10">
        <h2 className="text-3xl font-bold text-slate-900">Product Studio</h2>
        <p className="text-slate-500">Transform white-background photos into marketing assets (Powered by Qwen Wanx)</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Upload & Source */}
        <div className="lg:col-span-4 space-y-6">
          <div 
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer
              ${sourceImage ? 'border-slate-300 bg-slate-50' : 'border-primary bg-blue-50 hover:bg-blue-100'}
            `}
            onClick={() => fileInputRef.current?.click()}
          >
             <input 
               type="file" 
               className="hidden" 
               ref={fileInputRef} 
               accept="image/*"
               onChange={handleFileUpload}
             />
             
             {sourceImage ? (
               <div className="relative group">
                 <img src={sourceImage} alt="Source" className="w-full h-auto rounded-lg shadow-sm" />
                 <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-lg text-white font-medium">
                   Click to change
                 </div>
               </div>
             ) : (
               <div className="py-12">
                 <svg className="w-12 h-12 mx-auto text-primary mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                 <p className="text-slate-900 font-medium">Upload Product Photo</p>
                 <p className="text-sm text-slate-500 mt-1">White background recommended</p>
               </div>
             )}
          </div>

          <button
            onClick={generateSet}
            disabled={!sourceImage || !!loading}
            className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold text-lg hover:bg-slate-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transform hover:-translate-y-1 active:translate-y-0"
          >
            {loading ? `Generating ${loading}...` : 'Generate Asset Set'}
          </button>
          
          <div className="text-xs text-slate-400 text-center">
            Note: Process may take 10-30s per image.
          </div>
        </div>

        {/* Right Column: Results Gallery */}
        <div className="lg:col-span-8">
           {generatedImages.length === 0 && !loading ? (
             <div className="h-full min-h-[400px] flex items-center justify-center border-2 border-slate-100 rounded-xl bg-slate-50/50">
               <p className="text-slate-400">Generated assets will appear here</p>
             </div>
           ) : (
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               {/* Placeholders for loading state */}
               {loading && (
                 <div className="aspect-square bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col items-center justify-center p-6 animate-pulse">
                   <div className="w-12 h-12 border-4 border-slate-200 border-t-primary rounded-full animate-spin mb-4"></div>
                   <p className="text-slate-500 font-medium">Creating {loading}...</p>
                 </div>
               )}

               {generatedImages.map((img, idx) => (
                 <div key={idx} className="group relative bg-white p-3 rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
                   <div className="absolute top-5 left-5 bg-black/70 text-white text-xs px-2 py-1 rounded backdrop-blur-sm z-10">
                     {img.type}
                   </div>
                   <div className="aspect-square overflow-hidden rounded-lg bg-slate-100 relative">
                     <img src={img.url} alt={img.type} className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-500" />
                   </div>
                   <div className="mt-3 flex justify-between items-center">
                     <span className="text-sm font-medium text-slate-700">Generated by Qwen</span>
                     <a 
                       href={img.url} 
                       download={`product-${img.type.toLowerCase().replace(' ', '-')}.png`}
                       className="text-primary text-sm hover:underline font-medium"
                     >
                       Download
                     </a>
                   </div>
                 </div>
               ))}
             </div>
           )}
        </div>
      </div>
    </div>
  );
};

export default ProductStudio;