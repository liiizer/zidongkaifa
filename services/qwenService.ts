import { LeadProfile, ClientType, EmailTemplate, BackgroundReport } from "../types";

// Note: In a real production environment, this should be process.env.API_KEY
// Keeping the user's provided key for continuity as per the provided file content.
const API_KEY = process.env.API_KEY;
const BASE_URL = "https://dashscope.aliyuncs.com/api/v1";
const OPENAI_COMPAT_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1";

// Using a public CORS proxy to bypass browser restrictions.
const CORS_PROXY = "https://corsproxy.io/?";

// Helper to handle Fetch errors specifically for CORS
const safeFetch = async (url: string, options: RequestInit, retries = 2) => {
  const proxyUrl = `${CORS_PROXY}${encodeURIComponent(url)}`;

  for (let i = 0; i <= retries; i++) {
    try {
      const response = await fetch(proxyUrl, options);
      
      if (!response.ok) {
        // If it's a 504 (Timeout) or 429 (Rate Limit), and we have retries left, wait and retry
        if ((response.status === 504 || response.status === 429) && i < retries) {
           console.warn(`Attempt ${i + 1} failed with ${response.status}. Retrying...`);
           await new Promise(res => setTimeout(res, 2000 * (i + 1))); // Exponential-ish backoff
           continue;
        }

        const errorBody = await response.json().catch(() => ({ message: response.statusText }));
        
        if (response.status === 401) {
          throw new Error("Unauthorized: Invalid API Key.");
        }
        
        throw new Error(errorBody.message || errorBody.code || `API Error: ${response.status}`);
      }
      return await response.json();
    } catch (error: any) {
      console.error(`Fetch Attempt ${i + 1} Error:`, error);
      
      // If network error (often CORS/Proxy failure) and retries left, retry
      if ((error.message.includes('Failed to fetch') || error.name === 'TypeError') && i < retries) {
         await new Promise(res => setTimeout(res, 2000));
         continue;
      }

      if (i === retries) {
        if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
          throw new Error("Network Error: CORS proxy or firewall issue.");
        }
        throw error;
      }
    }
  }
};

// Helper for Qwen Text Generation
const callQwenText = async (messages: any[], enableSearch = false) => {
  const url = `${BASE_URL}/services/aigc/text-generation/generation`;
  
  const body = {
    model: "qwen-plus",
    input: { messages },
    parameters: {
      result_format: "message",
      enable_search: enableSearch
    }
  };

  const data = await safeFetch(url, {
    method: "POST",
    headers: {
        "Authorization": `Bearer ${API_KEY}`,
        "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  return data.output?.choices?.[0]?.message?.content || "";
};

// --- SINGLE LEAD ANALYSIS ---
export const analyzeLead = async (urlOrName: string): Promise<LeadProfile> => {
  const prompt = `
    Analyze the company: "${urlOrName}". 
    Identify their business model (Contractor, Wholesaler, Brand, etc.),
    find key decision makers (CEO, Owner, Procurement), and contact details.
    Infer the primary language based on the country.
    
    Return ONLY a valid JSON object matching this TypeScript interface:
    {
      companyName: string;
      website: string;
      clientType: "Contractor" | "Wholesaler" | "Brand Owner" | "Retailer" | "Unknown";
      keyContact: { name: string; role: string; };
      contactInfo: { email: string; phone: string; };
      country: string;
      language: string;
      summary: string;
    }
  `;

  const content = await callQwenText(
    [{ role: "user", content: prompt }],
    true // Enable Search
  );

  const jsonStr = content.replace(/```json\n?|\n?```/g, "").trim();
  try {
    return JSON.parse(jsonStr) as LeadProfile;
  } catch (e) {
    console.error("Failed to parse JSON", content);
    throw new Error("Invalid response format from Qwen.");
  }
};

// --- BATCH LEAD DISCOVERY (LOOPED) ---
export const findLeads = async (region: string, existingNames: string[] = []): Promise<LeadProfile[]> => {
  const TARGET_COUNT = 8; // Small batch for stability
  const BATCH_SIZE = 4; 
  const MAX_ITERATIONS = 4; // Safety limit
  
  let allLeads: LeadProfile[] = [];
  const knownNames = new Set<string>(existingNames.map(n => n.toLowerCase().trim()));

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    if (allLeads.length >= TARGET_COUNT) break;

    const remaining = TARGET_COUNT - allLeads.length;
    const currentAskCount = Math.min(remaining, BATCH_SIZE);
    
    // Construct exclusion list for the prompt
    const exclusionList = Array.from(knownNames).slice(-50).join(', ');
    const exclusionNote = knownNames.size > 0 
      ? `IMPORTANT: Do NOT include these companies which were already found: ${exclusionList}.`
      : "";

    const prompt = `
      Act as a specific industry researcher for the Sanitary Ware / Bathroom Sales team.
      Task: Find ${currentAskCount} NEW and ACTIVE B2B enterprises in the "Sanitary Ware / Bathroom / Plumbing" industry located in "${region}".
      Target: Prioritize Wholesalers, Importers, Brand Owners, or large Construction Contractors.
      
      ${exclusionNote}
      
      For each company found, infer their business type based on their activities.
      
      Return ONLY a JSON array containing objects with these fields:
      [
        {
          "companyName": "Name",
          "website": "URL",
          "clientType": "Wholesaler" | "Brand Owner" | "Contractor" | "Retailer",
          "keyContact": { "name": "Name or 'Purchasing Manager'", "role": "Role" },
          "contactInfo": { "email": "Email or 'N/A'", "phone": "Phone or 'N/A'" },
          "country": "${region}",
          "language": "Primary Language of Region",
          "summary": "Brief 1-sentence description"
        }
      ]
    `;

    try {
      const content = await callQwenText(
        [{ role: "user", content: prompt }],
        true // Enable Search
      );

      const jsonStr = content.replace(/```json\n?|\n?```/g, "").trim();
      let newLeads: any[] = [];
      try {
        newLeads = JSON.parse(jsonStr);
      } catch (e) {
        // sometimes it returns text before json
        const match = jsonStr.match(/\[.*\]/s);
        if (match) {
           newLeads = JSON.parse(match[0]);
        }
      }

      if (Array.isArray(newLeads)) {
        let addedInBatch = 0;
        for (const lead of newLeads) {
          const normalizedName = lead.companyName.toLowerCase().trim();
          if (!knownNames.has(normalizedName)) {
            allLeads.push(lead as LeadProfile);
            knownNames.add(normalizedName);
            addedInBatch++;
          }
        }
        
        if (addedInBatch === 0) {
            console.warn("No new leads found in this batch, stopping early.");
            break; 
        }
      }
    } catch (e) {
      console.error(`Batch ${i+1} failed`, e);
      // We continue to the next loop to try again, essentially a batch-level retry
    }
  }

  return allLeads;
};

// --- BACKGROUND REPORT GENERATION ---
export const generateBackgroundReport = async (lead: LeadProfile): Promise<BackgroundReport> => {
  const prompt = `
    Task: Conduct a comprehensive Due Diligence / Background Check Report on the following company.
    
    Company: ${lead.companyName}
    Website: ${lead.website}
    Region: ${lead.country}

    Use search to perform deep research. Look for:
    1. Corporate registry info, history, and scale.
    2. Their product portfolio and brands.
    3. Market reputation, customer reviews, and news.
    4. Any potential risks or red flags.

    IMPORTANT: Output the entire report in CHINESE (Simplified Chinese).
    Tone: Professional, Objective, Analytical (suitable for a Factory Export Manager).

    Return ONLY a valid JSON object matching this structure:
    {
      "companyName": "${lead.companyName}",
      "overview": "Detailed company history, scale, employee count, location.",
      "products": "Main product categories, brands carried, manufacturing capabilities.",
      "marketPosition": "Target market segments (high/mid/low), key competitors, reputation.",
      "financialStatus": "Revenue estimates, growth trends, or business scale indicators.",
      "riskAssessment": "Any legal disputes, negative reviews, credit risks, or supply chain issues.",
      "cooperationSuggestion": "Specific strategy on how to approach them based on their profile."
    }
  `;

  const content = await callQwenText(
    [{ role: "user", content: prompt }],
    true // Enable Search
  );

  const jsonStr = content.replace(/```json\n?|\n?```/g, "").trim();
  try {
    const report = JSON.parse(jsonStr);
    // Ensure all fields exist
    return {
      companyName: lead.companyName,
      overview: report.overview || "暂无信息",
      products: report.products || "暂无信息",
      marketPosition: report.marketPosition || "暂无信息",
      financialStatus: report.financialStatus || "暂无信息",
      riskAssessment: report.riskAssessment || "暂无信息",
      cooperationSuggestion: report.cooperationSuggestion || "建议尝试联系"
    } as BackgroundReport;
  } catch (e) {
    console.error("Failed to generate report", content);
    throw new Error("Failed to parse background report.");
  }
};

// --- EMAIL GENERATION (TEMPLATE BASED) ---
const USER_SIGNATURE = `Richie Lee | Foreign Sales Director

🏢 Guangdong Kinghope Sanitary Ware Technology Co., Ltd.

✉️ Richie@zhongtaokinghope.com

📞 +86 13828332207

🌐 www.zhongtaokinghope.com`;

const TEMPLATE_SUBJECT = "I hope my service can save you time, and my products can help you earn more money.";

export const generateColdEmail = async (lead: LeadProfile, report?: BackgroundReport): Promise<EmailTemplate> => {
  
  // Construct the prompt based on whether we have deep background info
  let strategyContext = "";
  
  if (report) {
    strategyContext = `
      BACKGROUND INSIGHTS (Use these to make the research claim in the email specific):
      - Market Position: ${report.marketPosition}
      - Core Products: ${report.products}
      - Strategic Advice: ${report.cooperationSuggestion}
      
      INSTRUCTION:
      In the email body, AFTER the phrase "I believe our products are a good fit for your product type and sales strategy", 
      add a specific sentence referencing these insights (e.g., "Especially considering your focus on [Product/Market]...")
    `;
  } else {
    strategyContext = `
      CLIENT TYPE: ${lead.clientType}
      
      INSTRUCTION:
      In the email body, AFTER the phrase "I believe our products are a good fit for your product type and sales strategy",
      add a specific sentence mentioning why we fit this client type (e.g. for Wholesalers mention pricing/stability, for Contractors mention specs/certifications).
    `;
  }

  const prompt = `
    You are Richie Lee, Foreign Sales Director at Guangdong Kinghope Sanitary Ware Technology Co., Ltd.
    
    Task: Write a targeted B2B cold email to:
    Prospect: ${lead.companyName}
    Contact: ${lead.keyContact.name}
    Region: ${lead.country}

    ${strategyContext}
    
    REFERENCE TEMPLATE (You MUST follow this structure):
    
    Subject: ${TEMPLATE_SUBJECT}
    
    Hi ${lead.keyContact.name},

    I have conducted thorough research on your company's website and the local market, and I believe our products are a good fit for your product type and sales strategy. [INSERT TARGETED SENTENCE HERE].

    I have selected some products that meet your needs; please see the attachment. If you are interested in our products or have any further questions, please feel free to contact me.

    Best regards!

    [SIGNATURE]

    REQUIREMENTS:
    1. Subject Line MUST be exactly: "${TEMPLATE_SUBJECT}"
    2. Signature MUST be exactly as provided below.
    3. The body MUST start with "I have conducted thorough research..." and end with "...feel free to contact me."
    4. You MUST insert the targeted sentence in the middle to make it personal.
    
    Signature to use:
    ${USER_SIGNATURE}

    Return ONLY a valid JSON object:
    {
      "subject": "string",
      "body": "string (complete body including signature)",
      "language": "string",
      "tone": "Professional & Sincere"
    }
  `;

  const content = await callQwenText(
    [{ role: "user", content: prompt }],
    false
  );

  const jsonStr = content.replace(/```json\n?|\n?```/g, "").trim();
  try {
    return JSON.parse(jsonStr) as EmailTemplate;
  } catch (e) {
    console.error("JSON Parse Error", content);
    throw new Error("Failed to generate email JSON");
  }
};

// --- IMAGE GENERATION ---
const analyzeImageWithVL = async (base64Image: string): Promise<string> => {
  const url = `${OPENAI_COMPAT_URL}/chat/completions`;
  const body = {
    model: "qwen-vl-plus",
    messages: [
      {
        role: "user",
        content: [
           { type: "text", text: "Describe this product concisely, focusing on visual features, color, and shape." },
           { type: "image_url", image_url: { url: `data:image/png;base64,${base64Image}` } }
        ]
      }
    ]
  };

  try {
    const data = await safeFetch(url, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${API_KEY}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
    });
    return data.choices?.[0]?.message?.content || "a commercial product";
  } catch (e) {
      return "a commercial product";
  }
};

const pollWanxTask = async (taskId: string): Promise<string> => {
  const url = `${BASE_URL}/tasks/${taskId}`;
  const maxAttempts = 30; 
  
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(r => setTimeout(r, 2000));
    
    const data = await safeFetch(url, {
        headers: { "Authorization": `Bearer ${API_KEY}` }
    });
    
    if (data.output?.task_status === "SUCCEEDED") {
        return data.output.results[0].url;
    }
    if (data.output?.task_status === "FAILED") {
        throw new Error(`Image generation failed: ${data.output?.message || 'Unknown error'}`);
    }
  }
  throw new Error("Timeout waiting for image generation");
};

export const generateProductScene = async (
  base64Image: string, 
  sceneType: 'Main' | 'Detail' | '3D Render'
): Promise<string> => {
  
  const description = await analyzeImageWithVL(base64Image);
  
  let prompt = "";
  let style = "<auto>";
  
  switch (sceneType) {
    case 'Main':
      prompt = `High-end commercial photography of ${description}, placed in a modern lifestyle environment, soft daylight, advertising quality, 4k.`;
      style = "<photography>";
      break;
    case 'Detail':
      prompt = `Extreme close-up macro photography of ${description}, showing texture and fine details, blurred minimalist background, studio lighting.`;
      style = "<photography>";
      break;
    case '3D Render':
      prompt = `3D C4D rendering of ${description}, isometric view, clay material style, soft pastel colors, clean edges, architectural visualization.`;
      style = "<3d cartoon>"; 
      break;
  }

  const url = `${BASE_URL}/services/aigc/text2image/image-synthesis`;
  const body = {
    model: "wanx-v1",
    input: { prompt: prompt },
    parameters: { style: style, size: "1024*1024", n: 1 }
  };

  const data = await safeFetch(url, {
    method: "POST",
    headers: {
        "Authorization": `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
        "X-DashScope-Async": "enable"
    },
    body: JSON.stringify(body)
  });
  
  if (!data.output?.task_id) throw new Error("No task ID returned from Wanx");
  
  return pollWanxTask(data.output.task_id);
};