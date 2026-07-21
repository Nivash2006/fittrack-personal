// Deno Edge Function — FitTrack AI Fitness Coach
// Handles secure client-side AI requests via Supabase vault secrets

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  // Handle CORS preflight options request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { systemPrompt, messages, userMessage } = await req.json();

    // Check Supabase environment variables for API keys
    const openAiKey = Deno.env.get('OPENAI_API_KEY');
    const geminiKey = Deno.env.get('GEMINI_API_KEY');
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');

    let reply = '';

    if (openAiKey) {
      // 1. CALL OPENAI (gpt-4o-mini)
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            ...messages.map((m: any) => ({
              role: m.role === 'model' ? 'assistant' : 'user',
              content: m.content,
            })),
            { role: 'user', content: userMessage },
          ],
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`OpenAI API returned status ${response.status}: ${errText}`);
      }

      const data = await response.json();
      reply = data.choices?.[0]?.message?.content || 'No response returned from OpenAI.';
    } else if (geminiKey) {
      // 2. CALL GEMINI (gemini-2.5-flash)
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              ...messages.map((m: any) => ({
                role: m.role === 'model' ? 'model' : 'user',
                parts: [{ text: m.content }],
              })),
              { role: 'user', parts: [{ text: userMessage }] },
            ],
            systemInstruction: {
              parts: [{ text: systemPrompt }],
            },
          }),
        }
      );

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Gemini API returned status ${response.status}: ${errText}`);
      }

      const data = await response.json();
      reply = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response returned from Gemini.';
    } else if (anthropicKey) {
      // 3. CALL CLAUDE (claude-3-5-sonnet)
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 1000,
          system: systemPrompt,
          messages: [
            ...messages.map((m: any) => ({
              role: m.role === 'model' ? 'assistant' : 'user',
              content: m.content,
            })),
            { role: 'user', content: userMessage },
          ],
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Anthropic API returned status ${response.status}: ${errText}`);
      }

      const data = await response.json();
      reply = data.content?.[0]?.text || 'No response returned from Anthropic.';
    } else {
      // No keys configured
      return new Response(
        JSON.stringify({
          error: 'NO_KEY_CONFIGURED',
          message: 'No AI API Key is configured in Supabase! Please set OPENAI_API_KEY, GEMINI_API_KEY, or ANTHROPIC_API_KEY inside your Supabase project vault secrets.',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(
      JSON.stringify({ reply }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: 'FUNCTION_ERROR', message: err.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
