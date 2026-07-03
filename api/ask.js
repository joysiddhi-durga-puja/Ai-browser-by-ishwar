// Deploy this on Vercel (root must have an `api/` folder — Vercel auto-detects
// it as a serverless function). Set GROQ_API_KEY in Vercel Project Settings ->
// Environment Variables. NEVER put the key in the app / frontend code.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!process.env.GROQ_API_KEY) {
    return res.status(500).json({ error: 'GROQ_API_KEY not configured on the server' });
  }

  const { question = '', pageContext = '', pageUrl = '', mode = 'ask', model = '' } = req.body || {};
  // Groq retired the old llama-3.x chat models, so default to a current one.
  // The app's model switcher lets users pass any other valid Groq model ID here.
  const selectedModel = (model && String(model).trim()) || 'openai/gpt-oss-20b';

  const trimmedContext = String(pageContext).slice(0, 6000);

  const prompts = {
    ask: `You are a helpful assistant embedded in a mobile browser app.
The user is currently on this page: ${pageUrl || 'unknown'}.
${trimmedContext ? `Visible page text for context:\n${trimmedContext}` : ''}
Answer concisely, in 3-6 short sentences or a short bullet list.`,

    explain: `You are a helpful assistant embedded in a mobile browser app.
The user wants a detailed explanation of the page they're on: ${pageUrl || 'unknown'}.
Page text:
${trimmedContext || '(no text extracted)'}
Explain what this page is about in detail, using short headers/bullets, mobile-friendly (avoid long paragraphs).`,

    tldr: `You are a helpful assistant embedded in a mobile browser app.
The user is reading a long page: ${pageUrl || 'unknown'} and wants a TL;DR.
Page text:
${trimmedContext || '(no text extracted)'}
Reply with ONLY 3-5 short bullet points summarizing the page. No preamble, no headers.`,

    find_answers: `You are analyzing a web page's text to find questions and answer them.
Page text:
${trimmedContext || '(no text extracted)'}
Find any questions present in this text (FAQs, quiz questions, form questions, etc.) and answer each one accurately using the page content.
Respond with ONLY valid JSON, no markdown, no extra text, in this exact format:
[{"question":"...","answer":"concise answer"}]
If no questions are found, respond with exactly: []`,

    wa_reply: `You are drafting a short, casual WhatsApp reply on behalf of the phone's owner (chat: ${pageUrl || 'unknown'}).
Incoming message(s):
${trimmedContext || '(no text)'}
Reply in 1-2 short sentences, matching the language/tone of the incoming message (Hindi/Hinglish/English). Output ONLY the reply text — no quotes, no labels, no explanation.`,
  };

  const systemPrompt = prompts[mode] || prompts.ask;
  const userMessage = question?.trim() || 'Follow the system instructions.';

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: selectedModel,
        max_tokens: 800,
        temperature: 0.3,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data.error?.message || 'Groq API error' });
    }

    const raw = data.choices?.[0]?.message?.content || '';

    if (mode === 'find_answers') {
      const cleaned = raw.replace(/```json|```/g, '').trim();
      let items = [];
      try {
        const parsed = JSON.parse(cleaned);
        if (Array.isArray(parsed)) items = parsed;
      } catch (e) {
        items = [];
      }
      return res.status(200).json({ items });
    }

    return res.status(200).json({ answer: raw || 'No answer returned.' });
  } catch (err) {
    return res.status(500).json({ error: 'Server error calling Groq API' });
  }
}
