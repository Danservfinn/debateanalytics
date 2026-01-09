/**
 * Z.ai GLM API Integration
 * Uses GLM-4.7 for analysis tasks
 * Compatible with OpenAI-style API
 *
 * IMPORTANT: Uses Coding Plan endpoint for unlimited API access
 */

const DEFAULT_MODEL = 'glm-4.7'; // Can also use 'glm-4.5', 'glm-4-air'
const DEFAULT_MAX_TOKENS = 4096;
const DEFAULT_TEMPERATURE = 0.7;

// API Endpoints
const STANDARD_API_URL = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';
const CODING_PLAN_API_URL = 'https://open.bigmodel.cn/api/coding/paas/v4/chat/completions';

// Use coding plan endpoint by default for unlimited access
const DEFAULT_API_URL = CODING_PLAN_API_URL;

interface GLMResult {
  success: boolean;
  text: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model?: string;
  finishReason?: string;
  error?: string;
}

interface ZaiMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ZaiResponseChoice {
  index: number;
  message: {
    role: string;
    content: string;
  };
  finish_reason: string;
}

interface ZaiResponseUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

interface ZaiResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: ZaiResponseChoice[];
  usage: ZaiResponseUsage;
}

/**
 * Z.ai GLM API wrapper with error handling and retry logic
 */
export async function callGLM({
  prompt,
  systemPrompt,
  maxTokens = DEFAULT_MAX_TOKENS,
  temperature = DEFAULT_TEMPERATURE,
  model = DEFAULT_MODEL,
  useCodingPlan = true, // Default to coding plan endpoint
}: {
  prompt: string;
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
  model?: string;
  useCodingPlan?: boolean;
}) {
  try {
    const apiKey = process.env.ZAI_API_KEY;

    if (!apiKey) {
      throw new Error('ZAI_API_KEY environment variable is not set');
    }

    // Build messages array
    const messages: ZaiMessage[] = [];

    if (systemPrompt) {
      messages.push({
        role: 'system',
        content: systemPrompt,
      });
    }

    messages.push({
      role: 'user',
      content: prompt,
    });

    // Select appropriate endpoint based on plan type
    const apiUrl = useCodingPlan ? CODING_PLAN_API_URL : STANDARD_API_URL;

    // Call Z.ai API (using coding plan endpoint for unlimited access)
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: maxTokens,
        temperature,
        stream: false,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Z.ai API error (${response.status}): ${errorText}`);
    }

    const data: ZaiResponse = await response.json();

    // Extract response text
    const text = data.choices[0]?.message?.content || '';

    return {
      success: true,
      text,
      usage: {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens,
      },
      model: data.model,
      finishReason: data.choices[0]?.finish_reason,
    };
  } catch (error) {
    console.error('Z.ai GLM API error:', error);

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      text: '',
    };
  }
}

/**
 * Call GLM with retry logic for transient failures
 */
export async function callGLMWithRetry(
  params: Parameters<typeof callGLM>[0],
  maxRetries = 3
) {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const result = await callGLM(params);

    if (result.success) {
      return result;
    }

    lastError = new Error(result.error || 'Unknown error');

    // Don't retry on authentication or permission errors
    if (
      result.error?.includes('invalid_api_key') ||
      result.error?.includes('authentication') ||
      result.error?.includes('permission') ||
      result.error?.includes('quota')
    ) {
      break;
    }

    // Exponential backoff
    const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
    console.log(`Retry ${attempt}/${maxRetries} after ${delay}ms...`);
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  return {
    success: false,
    error: lastError?.message || 'Max retries exceeded',
    text: '',
  };
}

/**
 * Extract JSON from GLM response
 * Handles cases where model wraps JSON in markdown code blocks
 * Uses multiple fallback strategies for robust parsing
 */
export function extractJSON(text: string, debug = false): Record<string, any> | null {
  if (debug) {
    console.log('[extractJSON] Input text length:', text.length);
    console.log('[extractJSON] First 500 chars:', text.substring(0, 500));
  }

  // Strategy 1: Try parsing directly first
  try {
    const direct = JSON.parse(text.trim());
    if (debug) console.log('[extractJSON] Direct parse succeeded');
    return direct;
  } catch {
    // Continue to other strategies
  }

  // Strategy 2: Extract from markdown code blocks (handles ```json and ```)
  const codeBlockPatterns = [
    /```json\s*([\s\S]*?)\s*```/i,
    /```\s*([\s\S]*?)\s*```/,
  ];

  for (const pattern of codeBlockPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      try {
        const parsed = JSON.parse(match[1].trim());
        if (debug) console.log('[extractJSON] Code block parse succeeded');
        return parsed;
      } catch {
        // Continue to next pattern
      }
    }
  }

  // Strategy 3: Find balanced JSON object using bracket matching
  const jsonObject = findBalancedJSON(text, '{', '}');
  if (jsonObject) {
    try {
      const parsed = JSON.parse(jsonObject);
      if (debug) console.log('[extractJSON] Balanced object parse succeeded');
      return parsed;
    } catch {
      // Continue to next strategy
    }
  }

  // Strategy 4: Find balanced JSON array
  const jsonArray = findBalancedJSON(text, '[', ']');
  if (jsonArray) {
    try {
      const parsed = JSON.parse(jsonArray);
      if (debug) console.log('[extractJSON] Balanced array parse succeeded');
      return { items: parsed }; // Wrap array in object for consistency
    } catch {
      // Continue to next strategy
    }
  }

  // Strategy 5: Try to repair common JSON issues
  const repaired = tryRepairJSON(text);
  if (repaired) {
    try {
      const parsed = JSON.parse(repaired);
      if (debug) console.log('[extractJSON] Repaired JSON parse succeeded');
      return parsed;
    } catch {
      // Continue to next strategy
    }
  }

  // Strategy 6: Try to complete truncated JSON (for cut-off responses)
  const completed = tryCompleteTruncatedJSON(text);
  if (completed) {
    try {
      const parsed = JSON.parse(completed);
      if (debug) console.log('[extractJSON] Truncation repair succeeded');
      return parsed;
    } catch {
      // Give up
    }
  }

  if (debug) console.log('[extractJSON] All strategies failed');
  return null;
}

/**
 * Find balanced JSON by matching opening and closing brackets
 */
function findBalancedJSON(text: string, openBracket: string, closeBracket: string): string | null {
  const startIdx = text.indexOf(openBracket);
  if (startIdx === -1) return null;

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = startIdx; i < text.length; i++) {
    const char = text[i];

    if (escape) {
      escape = false;
      continue;
    }

    if (char === '\\' && inString) {
      escape = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (char === openBracket) {
      depth++;
    } else if (char === closeBracket) {
      depth--;
      if (depth === 0) {
        return text.substring(startIdx, i + 1);
      }
    }
  }

  return null;
}

/**
 * Try to repair common JSON issues from LLM responses
 */
function tryRepairJSON(text: string): string | null {
  // Find potential JSON content
  let jsonText = text;

  // Remove leading/trailing non-JSON content
  const startMatch = jsonText.match(/[\[{]/);
  if (startMatch && startMatch.index !== undefined) {
    jsonText = jsonText.substring(startMatch.index);
  }

  // Find the last closing bracket
  const lastBrace = jsonText.lastIndexOf('}');
  const lastBracket = jsonText.lastIndexOf(']');
  const endIdx = Math.max(lastBrace, lastBracket);
  if (endIdx > 0) {
    jsonText = jsonText.substring(0, endIdx + 1);
  }

  // Common repairs
  jsonText = jsonText
    // Remove trailing commas before } or ]
    .replace(/,(\s*[}\]])/g, '$1')
    // Fix unquoted keys (simple cases)
    .replace(/(\{|\,)\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":')
    // Fix single quotes to double quotes (simple cases)
    .replace(/'([^'\\]*)'/g, '"$1"');

  return jsonText.trim() || null;
}

/**
 * Try to complete truncated JSON (e.g., when response was cut off mid-generation)
 * This handles common cases where arrays or objects are left incomplete
 */
function tryCompleteTruncatedJSON(text: string): string | null {
  let jsonText = text.trim();

  // Remove any markdown wrappers first
  jsonText = jsonText.replace(/^```json?\s*/i, '').replace(/\s*```$/i, '');

  // Count unmatched brackets
  let braceCount = 0;
  let bracketCount = 0;
  let inString = false;
  let escape = false;

  for (let i = 0; i < jsonText.length; i++) {
    const char = jsonText[i];

    if (escape) {
      escape = false;
      continue;
    }

    if (char === '\\' && inString) {
      escape = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (char === '{') braceCount++;
    else if (char === '}') braceCount--;
    else if (char === '[') bracketCount++;
    else if (char === ']') bracketCount--;
  }

  // If we're in a string, try to close it
  if (inString) {
    // Find the last quote and truncate string there, add closing quote
    const lastQuoteIdx = jsonText.lastIndexOf('"');
    if (lastQuoteIdx > 0) {
      // Truncate at a reasonable point (e.g., last complete word before truncation)
      const truncPoint = jsonText.substring(0, lastQuoteIdx).lastIndexOf(' ');
      if (truncPoint > lastQuoteIdx - 200) {
        jsonText = jsonText.substring(0, truncPoint) + '..."';
      } else {
        jsonText = jsonText.substring(0, lastQuoteIdx) + '"';
      }
      // Recalculate bracket counts after truncation
      braceCount = 0;
      bracketCount = 0;
      inString = false;
      for (let i = 0; i < jsonText.length; i++) {
        const char = jsonText[i];
        if (char === '\\' && inString) { i++; continue; }
        if (char === '"') { inString = !inString; continue; }
        if (inString) continue;
        if (char === '{') braceCount++;
        else if (char === '}') braceCount--;
        else if (char === '[') bracketCount++;
        else if (char === ']') bracketCount--;
      }
    }
  }

  // Remove any trailing incomplete content (partial key/value pairs)
  jsonText = jsonText.replace(/,\s*"[^"]*"?\s*:?\s*"?[^"]*$/, '');
  jsonText = jsonText.replace(/,\s*$/, '');

  // Close unclosed brackets and braces
  while (bracketCount > 0) {
    jsonText += ']';
    bracketCount--;
  }
  while (braceCount > 0) {
    jsonText += '}';
    braceCount--;
  }

  return jsonText.trim() || null;
}

/**
 * Streaming call to GLM (for real-time progress updates)
 * Note: Z.ai supports SSE streaming
 */
export async function* streamGLM(
  params: Parameters<typeof callGLM>[0]
): AsyncGenerator<string, void, unknown> {
  try {
    const apiKey = process.env.ZAI_API_KEY;

    if (!apiKey) {
      throw new Error('ZAI_API_KEY environment variable is not set');
    }

    const messages: ZaiMessage[] = [];

    if (params.systemPrompt) {
      messages.push({
        role: 'system',
        content: params.systemPrompt,
      });
    }

    messages.push({
      role: 'user',
      content: params.prompt,
    });

    // Use coding plan endpoint by default for streaming
    const useCodingPlan = params.useCodingPlan !== undefined ? params.useCodingPlan : true;
    const apiUrl = useCodingPlan ? CODING_PLAN_API_URL : STANDARD_API_URL;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: params.model || DEFAULT_MODEL,
        messages,
        max_tokens: params.maxTokens || DEFAULT_MAX_TOKENS,
        temperature: params.temperature || DEFAULT_TEMPERATURE,
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Z.ai streaming error: ${errorText}`);
    }

    // Read SSE stream
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);

          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices[0]?.delta?.content;

            if (content) {
              yield content;
            }
          } catch (e) {
            // Skip invalid JSON
            continue;
          }
        }
      }
    }
  } catch (error) {
    console.error('GLM streaming error:', error);
    throw error;
  }
}

/**
 * Batch processing for multiple independent calls
 */
export async function callGLMBatch(
  calls: Array<Parameters<typeof callGLM>[0]>,
  maxConcurrency = 5
): Promise<Array<GLMResult>> {
  const results: GLMResult[] = [];

  // Process in batches
  for (let i = 0; i < calls.length; i += maxConcurrency) {
    const batch = calls.slice(i, i + maxConcurrency);
    const batchResults = await Promise.all(
      batch.map(call => callGLM(call))
    );
    results.push(...batchResults);
  }

  return results;
}

/**
 * Model selection helpers
 */
export const GLM_MODELS = {
  GLM_4_7: 'glm-4.7',      // Highest quality, best for complex analysis
  GLM_4_5: 'glm-4.5',      // Balanced quality and speed
  GLM_4_AIR: 'glm-4-air',  // Fastest, good for simple tasks
  GLM_4_FLASH: 'glm-4-flash', // Ultra-fast, basic tasks
} as const;

/**
 * Get recommended model for specific task type
 */
export function getModelForTask(
  taskType: 'extraction' | 'steel_manning' | 'deception_detection' | 'fact_check' | 'fallacy' | 'synthesis'
): string {
  switch (taskType) {
    case 'extraction':
      return GLM_MODELS.GLM_4_5; // Fast but accurate
    case 'steel_manning':
      return GLM_MODELS.GLM_4_7; // Highest quality for nuanced reasoning
    case 'deception_detection':
      return GLM_MODELS.GLM_4_7; // Needs careful analysis
    case 'fact_check':
      return GLM_MODELS.GLM_4_7; // Critical for accuracy
    case 'fallacy':
      return GLM_MODELS.GLM_4_5; // Good balance
    case 'synthesis':
      return GLM_MODELS.GLM_4_7; // Combine all outputs
    default:
      return GLM_MODELS.GLM_4_7;
  }
}
