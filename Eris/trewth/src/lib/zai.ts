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
 */
export function extractJSON(text: string): Record<string, any> | null {
  try {
    // Try parsing directly first
    const direct = JSON.parse(text);
    return direct;
  } catch {
    // Try extracting JSON from markdown code blocks
    const jsonMatch = text.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[1]);
      } catch {
        return null;
      }
    }

    // Try to find JSON object in the text
    const objectMatch = text.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      try {
        return JSON.parse(objectMatch[0]);
      } catch {
        return null;
      }
    }

    return null;
  }
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
