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

    // Check Supabase environment variables for API keys (with case-insensitive fallbacks)
    const openAiKey = Deno.env.get('OPENAI_API_KEY') || Deno.env.get('openai_api_key') || Deno.env.get('OpenAI_API_Key');
    const geminiKey = Deno.env.get('GEMINI_API_KEY') || Deno.env.get('gemini_api_key') || Deno.env.get('Gemini_API_Key');
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY') || Deno.env.get('anthropic_api_key') || Deno.env.get('Anthropic_API_Key');
    const nvidiaKey = Deno.env.get('NVIDIA_API_KEY') || Deno.env.get('nvidia_api_key') || Deno.env.get('Nvidia_API_Key');
    const nvidiaModel = Deno.env.get('NVIDIA_MODEL') || Deno.env.get('nvidia_model') || 'nvidia/llama-3.1-nemotron-70b-instruct';

    let reply = '';

    if (nvidiaKey) {
      // 1. CALL NVIDIA NIM API (OpenAI-compatible format with self-healing fallback)
      const fetchNvidia = async (modelName: string) => {
        return await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${nvidiaKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: modelName,
            messages: [
              { role: 'system', content: systemPrompt },
              ...messages.map((m: any) => ({
                role: m.role === 'model' ? 'assistant' : 'user',
                content: m.content,
              })),
              { role: 'user', content: userMessage },
            ],
            temperature: 0.5,
            max_tokens: 1024,
          }),
        });
      };

      let response = await fetchNvidia(nvidiaModel);

      // Self-healing fallback if primary model is locked or 404s
      if (!response.ok) {
        const errText = await response.clone().text();
        console.warn(`Primary Nvidia model (${nvidiaModel}) failed: ${errText}. Retrying with fallback meta/llama-3.1-8b-instruct...`);
        response = await fetchNvidia('meta/llama-3.1-8b-instruct');
      }

      if (!response.ok) {
        const finalErrText = await response.text();
        throw new Error(`Nvidia API returned status ${response.status}: ${finalErrText}`);
      }

      const data = await response.json();
      reply = data.choices?.[0]?.message?.content || 'No response returned from Nvidia NIM.';
    } else if (openAiKey) {
      // 2. CALL OPENAI (gpt-4o-mini)
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
      // 3. CALL GEMINI (gemini-2.5-flash)
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
      // 4. CALL CLAUDE (claude-3-5-sonnet)
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
          message: 'No AI API Key is configured in Supabase! Please set NVIDIA_API_KEY, OPENAI_API_KEY, GEMINI_API_KEY, or ANTHROPIC_API_KEY inside your Supabase project vault secrets.',
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
    console.error("Deno Function Execution Error:", err.message, err.stack);
    return new Response(
      JSON.stringify({ error: 'FUNCTION_ERROR', message: err.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
