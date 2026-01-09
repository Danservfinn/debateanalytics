/**
 * PersuasionIntentAgent
 * Detects radicalization attempts, opinion-swaying techniques, and projects
 * what opinions the article is trying to impart on readers.
 *
 * Key Capabilities:
 * - Hit piece vs fluff piece classification
 * - Radicalization risk assessment
 * - Projected opinion extraction
 * - Enemy/tribe construction detection
 * - Persuasion technique identification
 */

import { callGLM, extractJSON } from "@/lib/zai"
import type {
  ExtractedArticle,
  PersuasionIntentResult,
  PersuasionInstance,
  PersuasionTechnique,
  ProjectedOpinion,
} from "@/types"

interface PersuasionIntentInput {
  article: ExtractedArticle
}

/**
 * Analyze article for persuasion intent and radicalization potential
 */
export async function analyzePersuasionIntent(input: PersuasionIntentInput): Promise<PersuasionIntentResult> {
  const { article } = input

  const systemPrompt = `You are an expert at detecting media persuasion, radicalization tactics, and opinion manipulation.

Your task is to analyze this article for:

1. ARTICLE INTENT CLASSIFICATION
   - hit_piece: Article designed to damage reputation of a person/organization/idea
   - fluff_piece: Uncritical puff piece designed to promote someone/something
   - advocacy: Openly argues for a position but acknowledges it
   - neutral: Balanced, fair reporting without clear bias toward attacking or promoting

2. PROJECTED OPINIONS
   What beliefs/opinions does this article want readers to adopt? Be specific.
   Rate the intensity (0-100) of how strongly it pushes each opinion.

3. PERSUASION TECHNIQUES
   Detect these specific techniques:
   - emotional_manipulation: Using emotions to bypass critical thinking
   - tribal_framing: "Us vs them" narratives
   - enemy_construction: Demonizing a person, group, or idea
   - moral_outrage: Manufacturing outrage to drive engagement
   - fear_mongering: Exaggerating threats
   - urgency_manufacturing: False sense of "act now"
   - authority_exploitation: Misusing expert credentials
   - oversimplification: Complex issues reduced to false binaries
   - false_consensus: "Everyone knows..." or "Most people agree..."
   - victimhood_narrative: Positioning group as persecuted
   - call_to_action: Explicit or implicit demands for action
   - identity_appeal: Appeals to identity (political, cultural, religious)

4. RADICALIZATION RISK
   - minimal: Standard news reporting
   - low: Some persuasive elements but reasonable
   - moderate: Clear attempt to shift opinions
   - high: Uses multiple radicalization techniques
   - severe: Dehumanization, calls for action against "enemies"

5. ENEMY CONSTRUCTION (if present)
   Who is positioned as the enemy? How are they characterized?
   Dehumanization levels: none, mild (disagreement), moderate (moral failing), severe (existential threat)

6. TRIBAL APPEAL (if present)
   What "in-group" does the article appeal to? What identity markers?

IMPORTANT: Return ONLY this exact JSON structure:
{
  "articleIntent": {
    "classification": "hit_piece|fluff_piece|advocacy|neutral",
    "confidence": 85,
    "targetSubject": "person or entity being attacked/promoted (null if neutral)",
    "indicators": ["specific evidence from article"]
  },
  "projectedOpinions": [
    {
      "statement": "The specific opinion readers should adopt",
      "intensity": 75,
      "supportingTechniques": ["technique names"],
      "beneficiaries": ["who benefits from this opinion"]
    }
  ],
  "techniques": [
    {
      "technique": "emotional_manipulation",
      "quote": "exact quote from article",
      "context": "surrounding context",
      "severity": "low|medium|high",
      "explanation": "how this manipulates readers",
      "targetedEmotion": "fear|anger|pride|belonging|outrage"
    }
  ],
  "enemyConstruction": {
    "target": "who is the enemy",
    "characterization": "how they are described",
    "dehumanizationLevel": "none|mild|moderate|severe"
  },
  "tribalAppeal": {
    "targetAudience": "who the article appeals to",
    "identityMarkers": ["political", "cultural", "values"],
    "exclusionaryLanguage": true
  },
  "callToAction": {
    "explicit": ["direct calls to action"],
    "implicit": ["implied actions readers should take"],
    "urgencyLevel": "none|low|medium|high"
  },
  "radicalizationRisk": "minimal|low|moderate|high|severe",
  "summary": "One paragraph assessment of the article's persuasion intent"
}

If the article is neutral/balanced, still return the structure but with empty arrays and appropriate values.

Return ONLY valid JSON. No markdown code blocks, no explanations.`

  const userPrompt = `Analyze this article for persuasion intent and radicalization potential:\n\n${JSON.stringify(article, null, 2)}`

  const result = await callGLM({
    prompt: userPrompt,
    systemPrompt,
    model: 'glm-4.7',
    maxTokens: 4000,
    temperature: 0.3,
  })

  if (!result.success) {
    throw new Error(`Persuasion intent analysis failed: ${result.error}`)
  }

  const DEBUG = process.env.DEBUG_AGENTS === 'true'
  if (DEBUG) {
    console.log('[PersuasionIntentAgent] Raw response length:', result.text.length)
    console.log('[PersuasionIntentAgent] Raw response preview:', result.text.substring(0, 500))
  }

  const data = extractJSON(result.text, DEBUG)

  if (!data) {
    console.warn('[PersuasionIntentAgent] JSON parsing failed, returning neutral result')
    return createNeutralResult()
  }

  // Validate and structure the result
  return validatePersuasionResult(data)
}

/**
 * Create a neutral result for articles with no persuasion detected
 */
function createNeutralResult(): PersuasionIntentResult {
  return {
    persuasionScore: 0,
    radicalizationRisk: 'minimal',
    articleIntent: {
      classification: 'neutral',
      confidence: 50,
      indicators: ['Unable to analyze - defaulting to neutral'],
    },
    projectedOpinions: [],
    techniques: [],
    summary: 'Analysis could not be completed. Article assumed to be neutral reporting.',
  }
}

/**
 * Validate and structure the raw LLM response
 */
function validatePersuasionResult(data: any): PersuasionIntentResult {
  // Validate techniques array
  const rawTechniques = Array.isArray(data.techniques) ? data.techniques : []
  const techniques: PersuasionInstance[] = rawTechniques.map((t: any) => ({
    id: crypto.randomUUID(),
    technique: validateTechnique(t.technique),
    quote: t.quote || '',
    context: t.context || '',
    severity: validateSeverity(t.severity),
    explanation: t.explanation || '',
    targetedEmotion: t.targetedEmotion,
  }))

  // Validate projected opinions
  const rawOpinions = Array.isArray(data.projectedOpinions) ? data.projectedOpinions : []
  const projectedOpinions: ProjectedOpinion[] = rawOpinions.map((o: any) => ({
    statement: o.statement || 'Unknown opinion',
    intensity: Math.min(100, Math.max(0, Number(o.intensity) || 0)),
    supportingTechniques: Array.isArray(o.supportingTechniques) ? o.supportingTechniques : [],
    beneficiaries: Array.isArray(o.beneficiaries) ? o.beneficiaries : undefined,
  }))

  // Calculate persuasion score based on techniques and opinions
  const persuasionScore = calculatePersuasionScore(techniques, projectedOpinions)

  // Validate article intent
  const articleIntent = {
    classification: validateClassification(data.articleIntent?.classification),
    confidence: Math.min(100, Math.max(0, Number(data.articleIntent?.confidence) || 50)),
    targetSubject: data.articleIntent?.targetSubject,
    indicators: Array.isArray(data.articleIntent?.indicators) ? data.articleIntent.indicators : [],
  }

  // Validate radicalization risk
  const radicalizationRisk = validateRadicalizationRisk(data.radicalizationRisk, techniques)

  // Build result
  const result: PersuasionIntentResult = {
    persuasionScore,
    radicalizationRisk,
    articleIntent,
    projectedOpinions,
    techniques,
    summary: data.summary || generateSummary(articleIntent, radicalizationRisk, techniques.length),
  }

  // Add optional fields if present
  if (data.enemyConstruction?.target) {
    result.enemyConstruction = {
      target: data.enemyConstruction.target,
      characterization: data.enemyConstruction.characterization || '',
      dehumanizationLevel: validateDehumanization(data.enemyConstruction.dehumanizationLevel),
    }
  }

  if (data.tribalAppeal?.targetAudience) {
    result.tribalAppeal = {
      targetAudience: data.tribalAppeal.targetAudience,
      identityMarkers: Array.isArray(data.tribalAppeal.identityMarkers) ? data.tribalAppeal.identityMarkers : [],
      exclusionaryLanguage: Boolean(data.tribalAppeal.exclusionaryLanguage),
    }
  }

  if (data.callToAction) {
    result.callToAction = {
      explicit: Array.isArray(data.callToAction.explicit) ? data.callToAction.explicit : [],
      implicit: Array.isArray(data.callToAction.implicit) ? data.callToAction.implicit : [],
      urgencyLevel: validateUrgency(data.callToAction.urgencyLevel),
    }
  }

  return result
}

function validateTechnique(technique: string): PersuasionTechnique {
  const validTechniques: PersuasionTechnique[] = [
    'emotional_manipulation',
    'tribal_framing',
    'enemy_construction',
    'moral_outrage',
    'fear_mongering',
    'urgency_manufacturing',
    'authority_exploitation',
    'oversimplification',
    'false_consensus',
    'victimhood_narrative',
    'call_to_action',
    'identity_appeal',
  ]
  return validTechniques.includes(technique as PersuasionTechnique)
    ? (technique as PersuasionTechnique)
    : 'emotional_manipulation'
}

function validateSeverity(severity: string): 'low' | 'medium' | 'high' {
  if (severity === 'high' || severity === 'medium' || severity === 'low') {
    return severity
  }
  return 'medium'
}

function validateClassification(classification: string): 'hit_piece' | 'fluff_piece' | 'advocacy' | 'neutral' {
  const valid = ['hit_piece', 'fluff_piece', 'advocacy', 'neutral']
  // Also accept legacy values and map them
  if (classification === 'balanced' || classification === 'neutral_reporting') {
    return 'neutral'
  }
  return valid.includes(classification)
    ? (classification as 'hit_piece' | 'fluff_piece' | 'advocacy' | 'neutral')
    : 'neutral'
}

function validateRadicalizationRisk(risk: string, techniques: PersuasionInstance[]): 'minimal' | 'low' | 'moderate' | 'high' | 'severe' {
  const valid = ['minimal', 'low', 'moderate', 'high', 'severe']
  if (valid.includes(risk)) {
    return risk as 'minimal' | 'low' | 'moderate' | 'high' | 'severe'
  }

  // Calculate based on techniques if not provided
  const highSeverity = techniques.filter(t => t.severity === 'high').length
  const hasEnemyConstruction = techniques.some(t => t.technique === 'enemy_construction')
  const hasTribalFraming = techniques.some(t => t.technique === 'tribal_framing')

  if (highSeverity >= 3 || (hasEnemyConstruction && hasTribalFraming && highSeverity >= 1)) {
    return 'high'
  } else if (highSeverity >= 2 || techniques.length >= 5) {
    return 'moderate'
  } else if (techniques.length >= 2) {
    return 'low'
  }
  return 'minimal'
}

function validateDehumanization(level: string): 'none' | 'mild' | 'moderate' | 'severe' {
  const valid = ['none', 'mild', 'moderate', 'severe']
  return valid.includes(level) ? (level as 'none' | 'mild' | 'moderate' | 'severe') : 'none'
}

function validateUrgency(level: string): 'none' | 'low' | 'medium' | 'high' {
  const valid = ['none', 'low', 'medium', 'high']
  return valid.includes(level) ? (level as 'none' | 'low' | 'medium' | 'high') : 'none'
}

/**
 * Calculate overall persuasion score
 */
function calculatePersuasionScore(techniques: PersuasionInstance[], opinions: ProjectedOpinion[]): number {
  let score = 0

  // Base score from technique severity
  techniques.forEach(t => {
    switch (t.severity) {
      case 'high': score += 15; break
      case 'medium': score += 10; break
      case 'low': score += 5; break
    }
  })

  // Additional score from opinion intensity
  if (opinions.length > 0) {
    const avgIntensity = opinions.reduce((sum, o) => sum + o.intensity, 0) / opinions.length
    score += avgIntensity * 0.3
  }

  return Math.min(100, Math.round(score))
}

/**
 * Generate summary if not provided by LLM
 */
function generateSummary(
  articleIntent: { classification: string; targetSubject?: string },
  risk: string,
  techniqueCount: number
): string {
  const classification = articleIntent.classification
  const target = articleIntent.targetSubject

  if (classification === 'hit_piece' && target) {
    return `This article appears to be a hit piece targeting ${target}. It uses ${techniqueCount} persuasion techniques with ${risk} radicalization risk.`
  } else if (classification === 'fluff_piece' && target) {
    return `This article appears to be promotional content for ${target}. It uses ${techniqueCount} persuasion techniques to present an uncritically positive view.`
  } else if (classification === 'advocacy') {
    return `This article openly advocates for a position using ${techniqueCount} persuasion techniques. Radicalization risk: ${risk}.`
  } else if (classification === 'neutral') {
    if (techniqueCount === 0) {
      return `This article appears to be neutral, balanced reporting without significant persuasion techniques detected.`
    }
    return `This article is generally neutral with ${techniqueCount} minor persuasion techniques detected. Radicalization risk: ${risk}.`
  }
  return `Standard reporting with ${techniqueCount} persuasion techniques detected. Radicalization risk: ${risk}.`
}
