import { RequestError, readLimited, type runtime } from './server.ts';

type Message = { role: 'system' | 'user' | 'assistant'; content: string };

export async function creativeCompletion(
  settings: ReturnType<typeof runtime>,
  messages: Message[],
  send: typeof fetch = fetch,
): Promise<unknown> {
  if (!settings.apiKey)
    throw new RequestError('Connect a chat API key first.', 503);
  const label =
    settings.provider === 'gemini'
      ? 'Gemini'
      : settings.provider === 'openrouter'
        ? 'OpenRouter'
        : 'The creative assistant';
  const gemini = settings.provider === 'gemini';
  const url = gemini
    ? `${settings.endpoint}/models/${encodeURIComponent(settings.model)}:generateContent`
    : `${settings.endpoint}/chat/completions`;
  const body = gemini
    ? {
        systemInstruction: {
          parts: messages
            .filter((m) => m.role === 'system')
            .map((m) => ({ text: m.content })),
        },
        contents: messages
          .filter((m) => m.role !== 'system')
          .map((m) => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }],
          })),
        generationConfig: {
          temperature: 1,
          maxOutputTokens: 4096,
          responseMimeType: 'application/json',
          thinkingConfig: settings.model.startsWith('gemini-2.5')
            ? { thinkingBudget: 1024 }
            : { thinkingLevel: 'low' },
        },
      }
    : {
        model: settings.model,
        temperature: 0.75,
        max_tokens: 1100,
        ...(settings.provider === 'openrouter'
          ? {
              reasoning: { effort: 'none', exclude: true },
              provider: {
                allow_fallbacks: false,
                max_price: { prompt: 0, completion: 0, request: 0 },
              },
            }
          : { response_format: { type: 'json_object' } }),
        messages,
      };
  let response: Response;
  try {
    response = await send(url, {
      method: 'POST',
      redirect: 'error',
      headers: {
        'Content-Type': 'application/json',
        ...(gemini
          ? { 'x-goog-api-key': settings.apiKey }
          : { Authorization: `Bearer ${settings.apiKey}` }),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(
        settings.provider === 'openrouter' ? 65000 : 35000,
      ),
    });
  } catch {
    throw new RequestError(
      `${label} couldn’t connect. Please try again shortly.`,
      503,
    );
  }
  if (!response.ok) {
    if (response.status >= 500)
      throw new RequestError(
        `${label} is temporarily unavailable. Please try again shortly.`,
        503,
      );
    if (response.status === 429)
      throw new RequestError(
        `${label} reached a usage limit. Please wait and try again, or check your API quota.`,
        429,
      );
    if ([401, 403].includes(response.status))
      throw new RequestError(
        `${label} access was rejected. Check the server API key and its permissions.`,
        503,
      );
    throw new RequestError(
      `${label} couldn’t complete the request. Check the configured model and try again.`,
      503,
    );
  }
  try {
    const data = JSON.parse(
      new TextDecoder().decode(await readLimited(response, 100000)),
    );
    const choice = gemini ? data.candidates?.[0] : data.choices?.[0];
    if (
      (gemini ? choice?.finishReason : choice?.finish_reason) !==
      (gemini ? 'STOP' : 'stop')
    )
      throw new Error('Incomplete output');
    const content = gemini
      ? choice.content?.parts
          ?.filter(
            (part: { text?: string; thought?: boolean }) =>
              typeof part.text === 'string' && !part.thought,
          )
          .map((part: { text: string }) => part.text)
          .join('')
      : choice.message?.content;
    const json =
      settings.provider === 'openrouter' && typeof content === 'string'
        ? content.trim().replace(/^```(?:json)?\s*([\s\S]*?)\s*```$/, '$1')
        : content;
    const result = JSON.parse(json || '');
    if (
      !result ||
      typeof result !== 'object' ||
      Array.isArray(result) ||
      !['chat', 'render'].includes(result.kind) ||
      typeof result.reply !== 'string'
    )
      throw new Error('Invalid brief');
    return result;
  } catch {
    throw new RequestError(
      'The creative brief didn’t come through completely. Please try again.',
      502,
    );
  }
}
