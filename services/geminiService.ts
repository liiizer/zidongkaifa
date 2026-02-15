import { GoogleGenAI, Type, Schema } from "@google/genai";
import { LeadProfile, ClientType, EmailTemplate, BackgroundReport } from "../types";

// Initialize with the environment key by default
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// --- LEAD ANALYSIS (Single) ---

export const analyzeLead = async (urlOrName: string): Promise<LeadProfile> => {
  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      companyName: { type: Type.STRING },
      clientType: { type: Type.STRING, enum: [
        ClientType.CONTRACTOR, 
        ClientType.WHOLESALER, 
        ClientType.BRAND, 
        ClientType.RETAILER, 
        ClientType.UNKNOWN
      ]},
      keyContact: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          role: { type: Type.STRING },
        }
      },
      contactInfo: {
        type: Type.OBJECT,
        properties: {
          email: { type: Type.STRING },
          phone: { type: Type.STRING },
        }
      },
      country: { type: Type.STRING },
      language: { type: Type.STRING },
      summary: { type: Type.STRING },
    },
    required: ["companyName", "clientType", "country", "language"],
  };

  const prompt = `
    Analyze the company: "${urlOrName}". 
    Use Google Search to find their official website, identify their business model (Contractor, Wholesaler, Brand, etc.),
    find key decision makers (CEO, Owner, Procurement), and contact details.
    Infer the primary language based on the country.
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: prompt,
    config: {
      tools: [{ googleSearch: {} }],
      responseMimeType: "application/json",
      responseSchema: schema
    }
  });

  if (!response.text) throw new Error("No data returned from Gemini");
  return JSON.parse(response.text) as LeadProfile;
};

// --- BATCH LEAD DISCOVERY ---

export const findLeads = async (region: string, existingNames: string[] = []): Promise<LeadProfile[]> => {
  const schema: Schema = {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        companyName: { type: Type.STRING },
        website: { type: Type.STRING },
        clientType: { type: Type.STRING, enum: [
          ClientType.CONTRACTOR, 
          ClientType.WHOLESALER, 
          ClientType.BRAND, 
          ClientType.RETAILER, 
          ClientType.UNKNOWN
        ]},
        keyContact: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            role: { type: Type.STRING },
          }
        },
        contactInfo: {
          type: Type.OBJECT,
          properties: {
            email: { type: Type.STRING },
            phone: { type: Type.STRING },
          }
        },
        country: { type: Type.STRING },
        language: { type: Type.STRING },
        summary: { type: Type.STRING },
      }
    }
  };

  const exclusionList = existingNames.slice(0, 50).join(", ");
  
  const prompt = `
    Act as a B2B market researcher. Find 5 to 8 NEW and REAL companies in the "Sanitary Ware / Bathroom / Plumbing" industry located in "${region}".
    Target: Wholesalers, Distributors, or Big Contractors.
    
    IMPORTANT:
    1. Do NOT include these companies (already found): ${exclusionList}.
    2. Use Google Search to verify they are active.
    3. Return real contact info where possible.
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview', // Pro model is better for Search grounding
    contents: prompt,
    config: {
      tools: [{ googleSearch: {} }],
      responseMimeType: "application/json",
      responseSchema: schema
    }
  });

  if (!response.text) throw new Error("Failed to find leads");
  return JSON.parse(response.text) as LeadProfile[];
};

// --- BACKGROUND REPORT GENERATION ---

export const generateBackgroundReport = async (lead: LeadProfile): Promise<BackgroundReport> => {
  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      companyName: { type: Type.STRING },
      overview: { type: Type.STRING, description: "Detailed company history, scale, employee count, location." },
      products: { type: Type.STRING, description: "Main product categories, brands carried, manufacturing capabilities." },
      marketPosition: { type: Type.STRING, description: "Target market segments (high/mid/low), key competitors, reputation." },
      financialStatus: { type: Type.STRING, description: "Revenue estimates, growth trends, or business scale indicators." },
      riskAssessment: { type: Type.STRING, description: "Any legal disputes, negative reviews, credit risks, or supply chain issues." },
      cooperationSuggestion: { type: Type.STRING, description: "Specific strategy on how to approach them based on their profile." },
    },
    required: ["companyName", "overview", "products", "marketPosition", "cooperationSuggestion"]
  };

  const prompt = `
    Task: Conduct a comprehensive Due Diligence / Background Check Report on the following company.
    
    Company: ${lead.companyName}
    Website: ${lead.website}
    Region: ${lead.country}

    Use Google Search to perform deep research. Look for:
    1. Corporate registry info, history, and scale.
    2. Their product portfolio and brands.
    3. Market reputation, customer reviews, and news.
    4. Any potential risks or red flags.

    IMPORTANT: Output the entire report in CHINESE (Simplified Chinese).
    Tone: Professional, Objective, Analytical (suitable for a Factory Export Manager).
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview', // Pro model is essential for complex research
    contents: prompt,
    config: {
      tools: [{ googleSearch: {} }],
      responseMimeType: "application/json",
      responseSchema: schema
    }
  });

  if (!response.text) throw new Error("Failed to generate report");
  return JSON.parse(response.text) as BackgroundReport;
};


// --- EMAIL GENERATION ---

export const generateColdEmail = async (lead: LeadProfile): Promise<EmailTemplate> => {
  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      subject: { type: Type.STRING },
      body: { type: Type.STRING },
      language: { type: Type.STRING },
      tone: { type: Type.STRING },
    }
  };

  const prompt = `
    Write a professional B2B cold email (development letter) to:
    Name: ${lead.keyContact.name || 'Purchasing Manager'}
    Role: ${lead.keyContact.role}
    Company: ${lead.companyName}
    Type: ${lead.clientType}
    Country: ${lead.country}
    Language: ${lead.language}

    The goal is to introduce our factory as a supplier. 
    Tailor the value proposition based on their type (e.g., for Brands focus on quality/OEM, for Wholesalers focus on margin/volume).
    Return the response in JSON.
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: schema
    }
  });

  if (!response.text) throw new Error("Failed to generate email");
  return JSON.parse(response.text) as EmailTemplate;
};

// --- IMAGE GENERATION ---

// Helper for Key Selection (required for Video/High-End Image models)
export const checkAndSelectKey = async () => {
  const win = window as any;
  if (win.aistudio && win.aistudio.hasSelectedApiKey) {
    const hasKey = await win.aistudio.hasSelectedApiKey();
    if (!hasKey && win.aistudio.openSelectKey) {
      await win.aistudio.openSelectKey();
    }
  }
};

export const generateProductScene = async (
  base64Image: string, 
  sceneType: 'Main' | 'Detail' | '3D Render'
): Promise<string> => {
  
  // Ensure we have a fresh client for image generation potentially using a user-selected key
  await checkAndSelectKey();
  const imageAi = new GoogleGenAI({ apiKey: process.env.API_KEY });

  let prompt = "";
  let aspectRatio = "1:1";

  switch (sceneType) {
    case 'Main':
      prompt = "Professional e-commerce product photography. Place this product in a modern, well-lit lifestyle setting appropriate for its use. High resolution, 4k, commercial advertisement standard.";
      break;
    case 'Detail':
      prompt = "Close-up macro shot of the product details. Minimalist background, soft studio lighting to highlight texture and quality. High depth of field.";
      aspectRatio = "3:4";
      break;
    case '3D Render':
      prompt = "Create a 3D architectural rendering style presentation of this product. Isometric view, studio lighting, clay render aesthetic mixed with realistic materials. Clean, sharp edges.";
      aspectRatio = "4:3";
      break;
  }

  try {
    const response = await imageAi.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: {
        parts: [
          { inlineData: { mimeType: 'image/png', data: base64Image } },
          { text: prompt }
        ]
      },
      config: {
        imageConfig: {
          aspectRatio: aspectRatio,
          imageSize: "1K" // Can be 2K or 4K with Pro model
        }
      }
    });

    // Extract image
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    throw new Error("No image generated");

  } catch (error) {
    console.error("Image generation failed:", error);
    throw error;
  }
};