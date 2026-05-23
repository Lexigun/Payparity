export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { contractText, contractType, jurisdiction } = req.body;

  if (!contractText || contractText.length < 100) {
    return res.status(400).json({ error: 'Contract text too short' });
  }

  const prompt = `You are an expert contract attorney specializing in ${contractType} agreements in ${jurisdiction}. 

Analyze this contract text and respond ONLY with a valid JSON object in this exact format:

{
  "score": <number 0-100, where 100 is perfectly clean and 0 is extremely dangerous>,
  "verdict": "<one of: SAFE, CAUTION, DANGER>",
  "summary": "<2-3 sentence plain English summary of the overall contract quality and the most important things to know>",
  "red_flags": [
    {"title": "<clause name>", "explanation": "<why this is a red flag and what it means for you in plain English>"}
  ],
  "yellow_flags": [
    {"title": "<clause name>", "explanation": "<why to watch this and what to negotiate>"}
  ],
  "green_flags": [
    {"title": "<clause name>", "explanation": "<why this is good for you>"}
  ],
  "questions": [
    "<specific question to ask the employer/client before signing>"
  ]
}

Rules:
- red_flags: clauses that are clearly harmful, one-sided, or legally risky (0-5 items)
- yellow_flags: clauses that are common but worth negotiating (0-4 items)
- green_flags: clauses that are genuinely favorable to the signer (0-3 items)
- questions: 3-5 specific, actionable questions to ask before signing
- If there are no red flags, return an empty array []
- Be specific — reference actual language from the contract when possible
- Write for a non-lawyer audience — no jargon
- Return ONLY the JSON object, no other text

Contract text to analyze:
${contractText.substring(0, 8000)}`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || 'Anthropic API error');
    }

    const rawText = data.content?.find(b => b.type === 'text')?.text || '';
    const clean = rawText.replace(/```json|```/g, '').trim();
    const result = JSON.parse(clean);

    return res.status(200).json(result);

  } catch (err) {
    return res.status(500).json({ error: err.message || 'Analysis failed' });
  }
}
