/**
 * Neo4j Connection Layer for Debate Analytics
 *
 * Provides graph database operations for storing and querying:
 * - Users with archetypes and debate history
 * - Arguments with semantic fingerprints
 * - Threads and debates
 * - Topics (dynamic, LLM-generated)
 * - Relationships (REPLIED_TO, CONVINCED, SIMILAR_TO, etc.)
 */

import neo4j, { Driver, Session, ManagedTransaction } from 'neo4j-driver'
import type {
  DebateThread,
  UserProfile,
  ArgumentFingerprint,
  ThreadAnalysisResult,
  UserStatus,
  BatchUserStatus
} from '@/types/debate'

// Singleton driver instance
let driver: Driver | null = null

/**
 * Get or create Neo4j driver connection
 */
export function getDriver(): Driver {
  if (!driver) {
    const uri = process.env.NEO4J_URI
    const user = process.env.NEO4J_USER
    const password = process.env.NEO4J_PASSWORD

    if (!uri || !user || !password) {
      throw new Error('Neo4j connection not configured. Set NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD environment variables.')
    }

    driver = neo4j.driver(uri, neo4j.auth.basic(user, password), {
      maxConnectionPoolSize: 50,
      connectionAcquisitionTimeout: 30000,
    })
  }
  return driver
}

/**
 * Close Neo4j connection (for cleanup)
 */
export async function closeDriver(): Promise<void> {
  if (driver) {
    await driver.close()
    driver = null
  }
}

/**
 * Execute a read transaction
 */
async function readTransaction<T>(
  work: (tx: ManagedTransaction) => Promise<T>
): Promise<T> {
  const session = getDriver().session()
  try {
    return await session.executeRead(work)
  } finally {
    await session.close()
  }
}

/**
 * Execute a write transaction
 */
async function writeTransaction<T>(
  work: (tx: ManagedTransaction) => Promise<T>
): Promise<T> {
  const session = getDriver().session()
  try {
    return await session.executeWrite(work)
  } finally {
    await session.close()
  }
}

// ============================================================================
// User Operations
// ============================================================================

/**
 * Check if a user profile is cached
 */
export async function getUserStatus(username: string): Promise<UserStatus> {
  return readTransaction(async (tx) => {
    const result = await tx.run(`
      MATCH (u:User {username: $username})
      RETURN u.archetype as archetype,
             u.archetypeConfidence as confidence,
             u.overallScore as overallScore,
             u.debatesAnalyzed as debatesAnalyzed,
             u.updatedAt as cachedAt
    `, { username })

    if (result.records.length === 0) {
      return { cached: false }
    }

    const record = result.records[0]
    return {
      cached: true,
      cachedAt: record.get('cachedAt')?.toString(),
      overallScore: record.get('overallScore')?.toNumber(),
      archetype: record.get('archetype') ? {
        primary: record.get('archetype'),
        confidence: record.get('confidence')?.toNumber()
      } : undefined,
      debatesAnalyzed: record.get('debatesAnalyzed')?.toNumber()
    }
  })
}

/**
 * Batch lookup for multiple users
 */
export async function getBatchUserStatus(usernames: string[]): Promise<BatchUserStatus> {
  return readTransaction(async (tx) => {
    const result = await tx.run(`
      UNWIND $usernames as username
      OPTIONAL MATCH (u:User {username: username})
      RETURN username,
             u IS NOT NULL as cached,
             u.archetype as archetype,
             u.overallScore as overallScore,
             u.signatureMoves as signatureMoves
    `, { usernames })

    const status: BatchUserStatus = {}

    for (const record of result.records) {
      const username = record.get('username')
      status[username] = {
        cached: record.get('cached'),
        archetype: record.get('archetype'),
        overallScore: record.get('overallScore')?.toNumber(),
        signatureMoves: record.get('signatureMoves') || []
      }
    }

    return status
  })
}

/**
 * Create or update a user profile
 */
export async function upsertUser(profile: UserProfile): Promise<void> {
  await writeTransaction(async (tx) => {
    await tx.run(`
      MERGE (u:User {username: $username})
      ON CREATE SET
        u.archetype = $archetype,
        u.archetypeConfidence = $archetypeConfidence,
        u.overallScore = $overallScore,
        u.debatesAnalyzed = 1,
        u.signatureMoves = $signatureMoves,
        u.knownWeaknesses = $knownWeaknesses,
        u.createdAt = datetime(),
        u.updatedAt = datetime()
      ON MATCH SET
        u.archetype = $archetype,
        u.archetypeConfidence = $archetypeConfidence,
        u.overallScore = $overallScore,
        u.debatesAnalyzed = u.debatesAnalyzed + 1,
        u.signatureMoves = $signatureMoves,
        u.knownWeaknesses = $knownWeaknesses,
        u.updatedAt = datetime()
    `, {
      username: profile.username,
      archetype: profile.archetype,
      archetypeConfidence: profile.archetypeConfidence,
      overallScore: profile.overallScore,
      signatureMoves: profile.signatureMoves || [],
      knownWeaknesses: profile.knownWeaknesses || []
    })
  })
}

// ============================================================================
// Thread & Debate Operations
// ============================================================================

/**
 * Store complete thread analysis in Neo4j
 */
export async function storeThreadAnalysis(analysis: ThreadAnalysisResult): Promise<void> {
  await writeTransaction(async (tx) => {
    // Create Thread node
    await tx.run(`
      MERGE (t:Thread {threadId: $threadId})
      SET t.subreddit = $subreddit,
          t.title = $title,
          t.author = $author,
          t.opPosition = $opPosition,
          t.analyzedAt = datetime(),
          t.debateCount = $debateCount,
          t.overallScore = $overallScore,
          t.commentCount = $commentCount
    `, {
      threadId: analysis.threadId,
      subreddit: analysis.subreddit,
      title: analysis.title,
      author: analysis.author,
      opPosition: analysis.verdict?.summary || '',
      debateCount: analysis.debates?.length || 0,
      overallScore: analysis.verdict?.overallScore || 0,
      commentCount: analysis.commentCount || 0
    })

    // Create Topic relationships (dynamic)
    if (analysis.topics) {
      for (const topic of analysis.topics) {
        await tx.run(`
          MERGE (topic:Topic {name: $topicName})
          ON CREATE SET topic.frequency = 1
          ON MATCH SET topic.frequency = topic.frequency + 1
          WITH topic
          MATCH (t:Thread {threadId: $threadId})
          MERGE (t)-[:ABOUT]->(topic)
        `, { topicName: topic, threadId: analysis.threadId })
      }
    }

    // Store debates
    if (analysis.debates) {
      for (const debate of analysis.debates) {
        await storeDebate(tx, analysis.threadId, debate)
      }
    }
  })
}

/**
 * Store a single debate within a thread
 */
async function storeDebate(
  tx: ManagedTransaction,
  threadId: string,
  debate: DebateThread
): Promise<void> {
  // Create Debate node
  await tx.run(`
    MATCH (t:Thread {threadId: $threadId})
    MERGE (d:Debate {debateId: $debateId})
    SET d.title = $title,
        d.winner = $winner,
        d.winnerReason = $winnerReason,
        d.proScore = $proScore,
        d.conScore = $conScore,
        d.replyCount = $replyCount,
        d.heatLevel = $heatLevel
    MERGE (t)-[:CONTAINS]->(d)
  `, {
    threadId,
    debateId: debate.id,
    title: debate.title,
    winner: debate.winner,
    winnerReason: debate.winnerReason,
    proScore: debate.proScore,
    conScore: debate.conScore,
    replyCount: debate.replyCount,
    heatLevel: debate.heatLevel || 0
  })

  // Store comments and relationships
  if (debate.replies) {
    for (const reply of debate.replies) {
      await tx.run(`
        MERGE (c:Comment {commentId: $commentId})
        SET c.author = $author,
            c.text = $text,
            c.position = $position,
            c.qualityScore = $qualityScore,
            c.isConcession = $isConcession,
            c.karma = $karma,
            c.createdAt = $createdAt
        WITH c
        MATCH (d:Debate {debateId: $debateId})
        MERGE (d)-[:HAS_COMMENT]->(c)
        WITH c
        MERGE (u:User {username: $author})
        MERGE (u)-[:AUTHORED]->(c)
      `, {
        commentId: reply.id,
        author: reply.author,
        text: reply.text.substring(0, 1000), // Truncate for storage
        position: reply.position,
        qualityScore: reply.qualityScore,
        isConcession: reply.isConcession || false,
        karma: reply.karma || 0,
        createdAt: reply.createdAt || new Date().toISOString(),
        debateId: debate.id
      })

      // Create REPLIED_TO relationship if has parent
      if (reply.parentId) {
        await tx.run(`
          MATCH (child:Comment {commentId: $childId})
          MATCH (parent:Comment {commentId: $parentId})
          MERGE (child)-[:REPLIED_TO]->(parent)
        `, { childId: reply.id, parentId: reply.parentId })
      }
    }
  }
}

// ============================================================================
// Argument Fingerprinting Operations
// ============================================================================

/**
 * Store an argument fingerprint
 */
export async function storeArgumentFingerprint(fingerprint: ArgumentFingerprint): Promise<void> {
  await writeTransaction(async (tx) => {
    await tx.run(`
      MERGE (a:Argument {hash: $hash})
      ON CREATE SET
        a.coreClaim = $coreClaim,
        a.claimType = $claimType,
        a.subject = $subject,
        a.predicate = $predicate,
        a.object = $object,
        a.semanticTags = $semanticTags,
        a.firstSeen = datetime(),
        a.frequency = 1,
        a.avgEffectiveness = 0
      ON MATCH SET
        a.frequency = a.frequency + 1
      WITH a
      MATCH (c:Comment {commentId: $commentId})
      MERGE (c)-[:CONTAINS_ARGUMENT]->(a)
    `, {
      hash: fingerprint.hash,
      coreClaim: fingerprint.coreClaim,
      claimType: fingerprint.claimType,
      subject: fingerprint.subject || '',
      predicate: fingerprint.predicate || '',
      object: fingerprint.object || '',
      semanticTags: fingerprint.semanticTags || [],
      commentId: fingerprint.commentId
    })
  })
}

/**
 * Find similar arguments by semantic tags
 */
export async function findSimilarArguments(
  semanticTags: string[],
  threshold: number = 0.5
): Promise<ArgumentFingerprint[]> {
  return readTransaction(async (tx) => {
    const result = await tx.run(`
      MATCH (a:Argument)
      WHERE ANY(tag IN $semanticTags WHERE tag IN a.semanticTags)
      WITH a,
           SIZE([tag IN $semanticTags WHERE tag IN a.semanticTags]) * 1.0 / SIZE($semanticTags) as similarity
      WHERE similarity >= $threshold
      RETURN a.hash as hash,
             a.coreClaim as coreClaim,
             a.claimType as claimType,
             a.semanticTags as semanticTags,
             a.frequency as frequency,
             similarity
      ORDER BY similarity DESC
      LIMIT 20
    `, { semanticTags, threshold })

    return result.records.map(record => ({
      hash: record.get('hash'),
      coreClaim: record.get('coreClaim'),
      claimType: record.get('claimType'),
      semanticTags: record.get('semanticTags'),
      frequency: record.get('frequency')?.toNumber(),
      similarity: record.get('similarity')
    } as ArgumentFingerprint))
  })
}

/**
 * Create SIMILAR_TO relationship between arguments
 */
export async function linkSimilarArguments(
  hash1: string,
  hash2: string,
  similarity: number
): Promise<void> {
  await writeTransaction(async (tx) => {
    await tx.run(`
      MATCH (a1:Argument {hash: $hash1})
      MATCH (a2:Argument {hash: $hash2})
      MERGE (a1)-[r:SIMILAR_TO]->(a2)
      SET r.similarity = $similarity
    `, { hash1, hash2, similarity })
  })
}

// ============================================================================
// Research Query Operations
// ============================================================================

/**
 * Get most effective arguments for a topic
 */
export async function getEffectiveArgumentsForTopic(
  topicName: string,
  limit: number = 20
): Promise<{ coreClaim: string; usageCount: number; concessions: number; avgQuality: number }[]> {
  return readTransaction(async (tx) => {
    const result = await tx.run(`
      MATCH (a:Argument)-[:RELATES_TO]->(:Topic {name: $topicName})
      MATCH (a)<-[:CONTAINS_ARGUMENT]-(c:Comment)
      OPTIONAL MATCH (a)-[led:LED_TO_CONCESSION]->()
      RETURN a.coreClaim as coreClaim,
             COUNT(DISTINCT c) as usageCount,
             SUM(COALESCE(led.count, 0)) as concessions,
             AVG(c.qualityScore) as avgQuality
      ORDER BY concessions DESC
      LIMIT $limit
    `, { topicName, limit: neo4j.int(limit) })

    return result.records.map(record => ({
      coreClaim: record.get('coreClaim'),
      usageCount: record.get('usageCount').toNumber(),
      concessions: record.get('concessions').toNumber(),
      avgQuality: record.get('avgQuality')
    }))
  })
}

/**
 * Get archetype persuadability
 */
export async function getArchetypePersuadability(
  archetype: string
): Promise<{ coreClaim: string; convincedCount: number }[]> {
  return readTransaction(async (tx) => {
    const result = await tx.run(`
      MATCH (u:User)-[:CONVINCED]->(target:User {archetype: $archetype})
      MATCH (u)-[:USED_ARGUMENT]->(a:Argument)
      RETURN a.coreClaim as coreClaim, COUNT(*) as convincedCount
      ORDER BY convincedCount DESC
      LIMIT 20
    `, { archetype })

    return result.records.map(record => ({
      coreClaim: record.get('coreClaim'),
      convincedCount: record.get('convincedCount').toNumber()
    }))
  })
}

/**
 * Record a persuasion event (when someone concedes or changes position)
 */
export async function recordPersuasionEvent(
  convincerUsername: string,
  convincedUsername: string,
  argumentHash: string,
  threadId: string
): Promise<void> {
  await writeTransaction(async (tx) => {
    // Create CONVINCED relationship
    await tx.run(`
      MATCH (convincer:User {username: $convincer})
      MATCH (convinced:User {username: $convinced})
      MERGE (convincer)-[r:CONVINCED]->(convinced)
      ON CREATE SET r.count = 1, r.threads = [$threadId]
      ON MATCH SET r.count = r.count + 1, r.threads = r.threads + $threadId
    `, {
      convincer: convincerUsername,
      convinced: convincedUsername,
      threadId
    })

    // Link argument to persuasion
    await tx.run(`
      MATCH (a:Argument {hash: $hash})
      MATCH (u:User {username: $convinced})
      MERGE (a)-[r:LED_TO_CONCESSION]->(u)
      ON CREATE SET r.count = 1
      ON MATCH SET r.count = r.count + 1
    `, { hash: argumentHash, convinced: convincedUsername })
  })
}

// ============================================================================
// Analytics Queries
// ============================================================================

/**
 * Get topic polarization over time
 */
export async function getTopicPolarization(
  topicName: string,
  days: number = 30
): Promise<{ date: string; polarization: number }[]> {
  return readTransaction(async (tx) => {
    const result = await tx.run(`
      MATCH (t:Thread)-[:ABOUT]->(topic:Topic {name: $topicName})
      WHERE t.analyzedAt > datetime() - duration({days: $days})
      MATCH (t)-[:CONTAINS]->(d:Debate)
      WITH date(t.analyzedAt) as day,
           d.proScore as proScore,
           d.conScore as conScore
      RETURN toString(day) as date,
             AVG(ABS(proScore - conScore)) as polarization
      ORDER BY day
    `, { topicName, days: neo4j.int(days) })

    return result.records.map(record => ({
      date: record.get('date'),
      polarization: record.get('polarization')
    }))
  })
}

/**
 * Get database statistics for monitoring
 */
export async function getDatabaseStats(): Promise<{
  threads: number
  debates: number
  arguments: number
  users: number
  topics: number
}> {
  return readTransaction(async (tx) => {
    const result = await tx.run(`
      MATCH (t:Thread) WITH count(t) as threads
      MATCH (d:Debate) WITH threads, count(d) as debates
      MATCH (a:Argument) WITH threads, debates, count(a) as arguments
      MATCH (u:User) WITH threads, debates, arguments, count(u) as users
      MATCH (topic:Topic)
      RETURN threads, debates, arguments, users, count(topic) as topics
    `)

    const record = result.records[0]
    return {
      threads: record.get('threads').toNumber(),
      debates: record.get('debates').toNumber(),
      arguments: record.get('arguments').toNumber(),
      users: record.get('users').toNumber(),
      topics: record.get('topics').toNumber()
    }
  })
}
