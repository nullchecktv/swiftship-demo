import {
  BedrockRuntimeClient,
  ApplyGuardrailCommand,
  ConverseCommand,
  GuardrailConfiguration,
} from '@aws-sdk/client-bedrock-runtime';
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

// ============================================================================
// TYPES
// ============================================================================

interface CustomerCommentInput {
  order_id: string;
  customer_id: string;
  comment: string;
  sentiment?: 'neutral' | 'frustrated' | 'angry';
  timestamp?: string;
}

interface CustomerContext {
  tier: 'vip_platinum' | 'premium' | 'standard';
  prior_exceptions: number;
  satisfaction_score: number;
  delivery_attempts: number;
  recent_refunds: number;
}

// ============================================================================
// CONFIGURATION
// ============================================================================
const MODEL_ID = process.env.MODEL_ID!;
const GUARDRAIL_ID = process.env.GUARDRAIL_ID!;
const GUARDRAIL_VERSION = process.env.GUARDRAIL_VERSION || 'DRAFT';
const ORDERS_TABLE = process.env.ORDERS_TABLE!;
const AUDIT_LOG_TABLE = process.env.AUDIT_LOG_TABLE!;
const COMMENT_MIN_LEN = 5;
const COMMENT_MAX_LEN = 2000;

const bedrockClient = new BedrockRuntimeClient({ region: process.env.AWS_REGION });
const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}));

// ============================================================================
// INPUT VALIDATION
// ============================================================================

function validateStructure(input: CustomerCommentInput): string[] {
  const errors: string[] = [];

  if (!input.order_id?.match(/^[A-Z][0-9]{3,6}$/)) errors.push('Invalid order_id format');
  if (!input.customer_id) errors.push('customer_id is required');
  if (!input.comment || input.comment.trim().length < COMMENT_MIN_LEN)
    errors.push(`comment must be at least ${COMMENT_MIN_LEN} chars`);
  if (input.comment.length > COMMENT_MAX_LEN)
    errors.push(`comment exceeds ${COMMENT_MAX_LEN} chars`);

  return errors;
}

// ============================================================================
// SHORT-CIRCUIT RULES (Deterministic logic)
// ============================================================================

async function applyShortCircuits(
  input: CustomerCommentInput,
  ctx: CustomerContext
): Promise<{ action: string; reason: string }> {
  // 1. Angry VIP with multiple failed deliveries → escalate immediately
  if (ctx.tier.startsWith('vip') && ctx.delivery_attempts >= 3) {
    return { action: 'escalate', reason: 'High-value customer with repeated failures' };
  }

  // 2. Neutral comment, low frustration → mark acknowledged, no model
  if (!input.sentiment || input.sentiment === 'neutral') {
    return { action: 'acknowledge', reason: 'Low-risk neutral feedback, no LLM required' };
  }

  return { action: 'no_short_circuit', reason: 'Requires AI interpretation' };
}

// ============================================================================
// GUARDRAILS (Heavier emphasis on malicious or unsafe text)
// ============================================================================

async function applyGuardrails(text: string) {
  const cmd = new ApplyGuardrailCommand({
    guardrailIdentifier: GUARDRAIL_ID,
    guardrailVersion: GUARDRAIL_VERSION,
    source: 'INPUT',
    content: [{ text: { text } }],
  });
  const res = await bedrockClient.send(cmd);

  if (res.action === 'GUARDRAIL_INTERVENED') {
    return { passed: false, violations: ['Toxic, PII, or injection attempt detected'] };
  }

  const sanitized = res.outputs?.[0]?.text ?? text;
  return { passed: true, sanitized };
}

// ============================================================================
// AGENT INVOCATION (Bedrock Converse)
// ============================================================================

async function invokeCustomerAgent(prompt: string, ctx: CustomerContext) {
  const guardrailConfig: GuardrailConfiguration = {
    guardrailIdentifier: GUARDRAIL_ID,
    guardrailVersion: GUARDRAIL_VERSION,
    trace: 'enabled',
  };

  const res = await bedrockClient.send(
    new ConverseCommand({
      modelId: MODEL_ID,
      messages: [{ role: 'user', content: [{ text: prompt }] }],
      system: [{ text: 'You are a logistics triage agent. Respond calmly and professionally.' }],
      guardrailConfig,
      inferenceConfig: { temperature: 0.1, maxTokens: 1000 },
    })
  );

  return res.output?.message?.content?.[0]?.text ?? 'No response';
}

// ============================================================================
// HANDLER
// ============================================================================

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const input = JSON.parse(event.body || '{}') as CustomerCommentInput;

  // 1. Structure validation
  const errs = validateStructure(input);
  if (errs.length) return { statusCode: 400, body: JSON.stringify({ error: errs }) };

  // 2. Guardrail: high-risk input
  const guard = await applyGuardrails(input.comment);
  if (!guard.passed)
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Unsafe input', details: guard.violations }),
    };

  // 3. Enrich context
  const ctx = await getCustomerContext(input.order_id);

  // 4. Deterministic short-circuits
  const rule = await applyShortCircuits(input, ctx);
  if (rule.action !== 'no_short_circuit') {
    await logDecision(input.order_id, input, rule);
    return { statusCode: 200, body: JSON.stringify(rule) };
  }

  // 5. Compose prompt for model
  const prompt = `Customer ${input.customer_id} left a comment: "${guard.sanitized}".
  Based on context: ${JSON.stringify(ctx)}, decide if this should be
  escalated, refunded, or acknowledged.`;

  const reply = await invokeCustomerAgent(prompt, ctx);
  await logDecision(input.order_id, input, { action: 'agent_decision', reason: reply });

  return { statusCode: 200, body: JSON.stringify({ decision: reply }) };
};
