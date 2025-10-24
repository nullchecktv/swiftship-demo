import { Handler, APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import {
  BedrockRuntimeClient,
  ApplyGuardrailCommand,
  ApplyGuardrailCommandInput,
  ConverseCommand,
  ConverseCommandInput,
  GuardrailConfiguration
} from '@aws-sdk/client-bedrock-runtime';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

interface DriverExceptionInput {
  order_id: string;
  driver_id: string;
  exception_type: 'customer_not_home' | 'address_issue' | 'damaged_package' | 'access_restricted' | 'other';
  notes: string;
  photo_url?: string;
  timestamp?: string;
}

interface OrderContext {
  customer_tier: 'vip' | 'premium' | 'standard';
  delivery_attempts: number;
  sla_deadline?: string;
  is_perishable: boolean;
  contains_hazmat: boolean;
  order_value: number;
  package_weight_lbs: number;
}

interface ShortCircuitDecision {
  action: 'hold_for_pickup' | 'standard_retry' | 'escalate' | 'no_short_circuit';
  reason: string;
  confidence: 'high' | 'medium';
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const MODEL_ID = process.env.MODEL_ID || 'anthropic.claude-sonnet-4-20250514';
const GUARDRAIL_ID = process.env.GUARDRAIL_ID!;
const GUARDRAIL_VERSION = process.env.GUARDRAIL_VERSION || 'DRAFT';
const ORDERS_TABLE = process.env.ORDERS_TABLE || 'shipping-orders';
const AUDIT_LOG_TABLE = process.env.AUDIT_LOG_TABLE || 'agent-decisions';

const ORDER_ID_PATTERN = /^[A-Z][0-9]{3,6}$/;
const MAX_NOTES_LENGTH = 500;
const MIN_NOTES_LENGTH = 10;

// AWS SDK Clients
const bedrockClient = new BedrockRuntimeClient({ region: process.env.AWS_REGION });
const dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));

// ============================================================================
// INPUT VALIDATION (Structural only - content validation via Guardrails)
// ============================================================================

/**
 * Validates only the structure and format of input
 * Content safety (PII, profanity, attacks) handled by Bedrock Guardrails
 */
function validateInputStructure(input: DriverExceptionInput): string[] {
  const errors: string[] = [];

  // Order ID format
  if (!input.order_id || !ORDER_ID_PATTERN.test(input.order_id)) {
    errors.push('order_id must match pattern: [A-Z][0-9]{3,6} (e.g., B456)');
  }

  // Driver ID
  if (!input.driver_id || input.driver_id.length < 3) {
    errors.push('driver_id is required (min 3 characters)');
  }

  // Exception type
  const validTypes = ['customer_not_home', 'address_issue', 'damaged_package', 'access_restricted', 'other'];
  if (!validTypes.includes(input.exception_type)) {
    errors.push(`exception_type must be one of: ${validTypes.join(', ')}`);
  }

  // Notes length
  if (!input.notes || input.notes.trim().length < MIN_NOTES_LENGTH) {
    errors.push(`notes must be at least ${MIN_NOTES_LENGTH} characters`);
  }

  if (input.notes && input.notes.length > MAX_NOTES_LENGTH) {
    errors.push(`notes must not exceed ${MAX_NOTES_LENGTH} characters`);
  }

  return errors;
}

// ============================================================================
// BUSINESS RULE SHORT CIRCUITS
// ============================================================================

/**
 * Applies business rules to short-circuit simple cases without calling the LLM
 * This saves cost and latency for deterministic scenarios
 *
 * Short Circuit Rules:
 * 1. HAZMAT + any exception = always hold for pickup (safety first)
 * 2. Standard customer + customer_not_home + first attempt = standard retry (common case)
 * 3. 5+ delivery attempts = escalate to manager (pattern of failure)
 * 4. Access restricted + gated community = standard process with note
 */
async function applyShortCircuitRules(
  input: DriverExceptionInput,
  context: OrderContext
): Promise<ShortCircuitDecision> {

  // Rule 1: HAZMAT packages can NEVER be expedited or left unattended
  // Always hold for pickup, no exceptions
  if (context.contains_hazmat) {
    return {
      action: 'hold_for_pickup',
      reason: 'Package contains hazardous materials - must be held for customer pickup per DOT regulations',
      confidence: 'high'
    };
  }

  // Rule 2: First delivery attempt failure for standard customers
  // This is the most common case - just retry tomorrow
  if (
    input.exception_type === 'customer_not_home' &&
    context.delivery_attempts === 1 &&
    context.customer_tier === 'standard' &&
    !context.is_perishable
  ) {
    return {
      action: 'standard_retry',
      reason: 'First delivery attempt for standard customer - schedule standard retry',
      confidence: 'high'
    };
  }

  // Rule 3: Too many delivery attempts indicates systemic issue
  // Human review needed
  if (context.delivery_attempts >= 5) {
    return {
      action: 'escalate',
      reason: `${context.delivery_attempts} delivery attempts failed - requires manager investigation`,
      confidence: 'high'
    };
  }

  // Rule 4: Access restricted for large packages (> 50 lbs)
  // These often need special delivery arrangements
  if (
    input.exception_type === 'access_restricted' &&
    context.package_weight_lbs > 50
  ) {
    return {
      action: 'escalate',
      reason: 'Heavy package with access restrictions - requires specialized delivery coordination',
      confidence: 'medium'
    };
  }

  // No short circuit applies - need LLM decision
  return {
    action: 'no_short_circuit',
    reason: 'Complex scenario requires AI agent analysis',
    confidence: 'high'
  };
}

// ============================================================================
// BEDROCK GUARDRAILS VALIDATION
// ============================================================================

/**
 * Uses Bedrock Guardrails API to validate content safety
 * Checks for: PII, profanity, prompt injection attacks, toxic content
 *
 * Returns: { passed: boolean, sanitizedText?: string, violations?: string[] }
 */
async function applyGuardrails(text: string): Promise<{
  passed: boolean;
  sanitizedText?: string;
  violations?: string[];
  action?: string;
}> {

  const input: ApplyGuardrailCommandInput = {
    guardrailIdentifier: GUARDRAIL_ID,
    guardrailVersion: GUARDRAIL_VERSION,
    source: 'INPUT', // We're validating input text
    content: [{
      text: { text }
    }]
  };

  try {
    const command = new ApplyGuardrailCommand(input);
    const response = await bedrockClient.send(command);

    // Check if guardrail blocked the content
    if (response.action === 'GUARDRAIL_INTERVENED') {
      const violations: string[] = [];

      // Extract violation details
      if (response.assessments) {
        for (const assessment of response.assessments) {
          // Content policy violations (hate, violence, sexual, etc.)
          if (assessment.contentPolicy?.filters) {
            for (const filter of assessment.contentPolicy.filters) {
              if (filter.action === 'BLOCKED') {
                violations.push(`Content policy: ${filter.type} (confidence: ${filter.confidence})`);
              }
            }
          }

          // Sensitive information (PII)
          if (assessment.sensitiveInformationPolicy?.piiEntities) {
            for (const pii of assessment.sensitiveInformationPolicy.piiEntities) {
              if (pii.action === 'BLOCKED' || pii.action === 'ANONYMIZED') {
                violations.push(`PII detected: ${pii.type} (action: ${pii.action})`);
              }
            }
          }

          // Word policy (profanity)
          if (assessment.wordPolicy?.customWords) {
            for (const word of assessment.wordPolicy.customWords) {
              if (word.action === 'BLOCKED') {
                violations.push(`Blocked word: ${word.match}`);
              }
            }
          }

          // Topic policy (off-topic content)
          if (assessment.topicPolicy?.topics) {
            for (const topic of assessment.topicPolicy.topics) {
              if (topic.action === 'BLOCKED') {
                violations.push(`Off-topic: ${topic.name}`);
              }
            }
          }
        }
      }

      return {
        passed: false,
        violations,
        action: response.action
      };
    }

    // Guardrails passed - extract sanitized text if PII was anonymized
    let sanitizedText = text;
    if (response.outputs && response.outputs.length > 0) {
      const output = response.outputs[0];
      if (output.text) {
        sanitizedText = output.text;
      }
    }

    return {
      passed: true,
      sanitizedText
    };

  } catch (error) {
    console.error('Guardrails API error:', error);
    // Fail closed - if guardrails service is down, block the request
    return {
      passed: false,
      violations: ['Guardrails service unavailable - request blocked for safety'],
      action: 'GUARDRAIL_INTERVENED'
    };
  }
}

// ============================================================================
// DATA ENRICHMENT
// ============================================================================

/**
 * Fetches order context from DynamoDB
 * This gives us the data needed for short-circuit rules and agent context
 */
async function getOrderContext(orderId: string): Promise<OrderContext | null> {
  try {
    const result = await dynamoClient.send(new GetCommand({
      TableName: ORDERS_TABLE,
      Key: { order_id: orderId }
    }));

    if (!result.Item) {
      console.warn(`Order ${orderId} not found in database`);
      return null;
    }

    return {
      customer_tier: result.Item.customer_tier || 'standard',
      delivery_attempts: result.Item.delivery_attempts || 0,
      sla_deadline: result.Item.sla_deadline,
      is_perishable: result.Item.is_perishable || false,
      contains_hazmat: result.Item.contains_hazmat || false,
      order_value: result.Item.order_value || 0,
      package_weight_lbs: result.Item.package_weight_lbs || 0
    };
  } catch (error) {
    console.error('Failed to fetch order context:', error);
    return null;
  }
}

// ============================================================================
// AGENT INVOCATION WITH CONVERSE API
// ============================================================================

/**
 * Invokes the model using Bedrock Converse API with tool support
 * Implements agentic loop: model → tool call → model → final response
 * Applies guardrails to OUTPUT to validate the agent's decision
 */
async function invokeAgentWithTools(
  userPrompt: string,
  context: OrderContext
): Promise<{
  finalResponse: string;
  toolCalls: any[];
  outputGuardrailResult?: any;
}> {

  const conversationHistory: any[] = [
    {
      role: 'user',
      content: [{ text: userPrompt }]
    }
  ];

  const toolCalls: any[] = [];
  const maxIterations = 10; // Prevent infinite loops
  let iterations = 0;

  // Configure guardrails for OUTPUT validation
  const guardrailConfig: GuardrailConfiguration = {
    guardrailIdentifier: GUARDRAIL_ID,
    guardrailVersion: GUARDRAIL_VERSION,
    trace: 'enabled' // Enable trace to see what guardrails caught
  };

  while (iterations < maxIterations) {
    iterations++;

    const converseInput: ConverseCommandInput = {
      modelId: MODEL_ID,
      messages: conversationHistory,
      system: [{ text: SYSTEM_PROMPT }],
      toolConfig: {
        tools: TOOLS.map(tool => ({
          toolSpec: {
            name: tool.name,
            description: tool.description,
            inputSchema: { json: tool.input_schema }
          }
        }))
      },
      guardrailConfig, // Apply guardrails to OUTPUT
      inferenceConfig: {
        maxTokens: 2000,
        temperature: 0.1, // Low temperature for deterministic decisions
      }
    };

    console.log(`[Iteration ${iterations}] Calling Converse API...`);

    const response = await bedrockClient.send(new ConverseCommand(converseInput));

    // Check if guardrails intervened on the OUTPUT
    if (response.stopReason === 'guardrail_intervened') {
      console.warn('Output guardrails intervened!');

      return {
        finalResponse: 'Agent output was blocked by guardrails',
        toolCalls,
        outputGuardrailResult: {
          intervened: true,
          trace: response.trace
        }
      };
    }

    // Add assistant response to conversation
    conversationHistory.push({
      role: 'assistant',
      content: response.output?.message?.content || []
    });

    // Check stop reason
    if (response.stopReason === 'end_turn') {
      // Model finished - extract final text
      const textContent = response.output?.message?.content?.find((c: any) => c.text);
      return {
        finalResponse: textContent?.text || 'No response generated',
        toolCalls,
        outputGuardrailResult: {
          intervened: false,
          trace: response.trace
        }
      };
    }

    if (response.stopReason === 'tool_use') {
      // Model wants to use tools
      const toolUseBlocks = response.output?.message?.content?.filter((c: any) => c.toolUse) || [];

      if (toolUseBlocks.length === 0) {
        throw new Error('Model indicated tool_use but no tool blocks found');
      }

      // Execute each tool call
      const toolResults: any[] = [];

      for (const block of toolUseBlocks) {
        const { toolUseId, name, input } = block.toolUse;

        console.log(`[Tool Call] ${name}(${JSON.stringify(input)})`);

        try {
          const result = executeToolCall(name, input, context);

          toolCalls.push({
            tool: name,
            input,
            output: result
          });

          toolResults.push({
            toolUseId,
            content: [{ json: result }]
          });

        } catch (error: any) {
          console.error(`Tool execution failed: ${error.message}`);

          toolResults.push({
            toolUseId,
            content: [{ text: `Error: ${error.message}` }],
            status: 'error'
          });
        }
      }

      // Add tool results to conversation
      conversationHistory.push({
        role: 'user',
        content: toolResults
      });

      // Continue the loop - model will process tool results
      continue;
    }

    // Unexpected stop reason
    throw new Error(`Unexpected stop reason: ${response.stopReason}`);
  }

  throw new Error('Max iterations reached - agent loop did not converge');
}

// ============================================================================
// AUDIT LOGGING
// ============================================================================

/**
 * Logs decision to DynamoDB for compliance and debugging
 * Records: input, decision, reasoning, execution path, and tool calls
 */
async function logDecision(
  orderId: string,
  input: DriverExceptionInput,
  decision: {
    type: 'short_circuit' | 'agent_decision';
    action: string;
    reason: string;
    agentResponse?: string;
    toolCalls?: any[];
    outputGuardrailResult?: any;
  }
): Promise<void> {
  try {
    await dynamoClient.send(new PutCommand({
      TableName: AUDIT_LOG_TABLE,
      Item: {
        decision_id: `${orderId}-${Date.now()}`,
        order_id: orderId,
        event_type: 'driver_exception',
        timestamp: new Date().toISOString(),
        driver_id: input.driver_id,
        exception_type: input.exception_type,
        decision_type: decision.type,
        action_taken: decision.action,
        reasoning: decision.reason,
        agent_response: decision.agentResponse,
        tool_calls: decision.toolCalls,
        output_guardrail_result: decision.outputGuardrailResult,
        input_notes: input.notes,
      }
    }));
  } catch (error) {
    console.error('Failed to log decision (non-fatal):', error);
  }
}

// ============================================================================
// LAMBDA HANDLER
// ============================================================================

export const handler: Handler<APIGatewayProxyEvent, APIGatewayProxyResult> = async (event) => {
  const requestId = event.requestContext?.requestId || `req_${Date.now()}`;
  console.log(`[${requestId}] Processing driver exception`);

  // ========================================================================
  // 1. PARSE AND VALIDATE STRUCTURE
  // ========================================================================
  let input: DriverExceptionInput;
  try {
    input = JSON.parse(event.body || '{}');
  } catch (error) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Invalid JSON' })
    };
  }

  const structureErrors = validateInputStructure(input);
  if (structureErrors.length > 0) {
    console.warn(`[${requestId}] Structure validation failed:`, structureErrors);
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Validation failed',
        details: structureErrors
      })
    };
  }

  // ========================================================================
  // 2. FETCH ORDER CONTEXT
  // ========================================================================
  const context = await getOrderContext(input.order_id);
  if (!context) {
    console.error(`[${requestId}] Order ${input.order_id} not found`);
    return {
      statusCode: 404,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Order not found' })
    };
  }

  console.log(`[${requestId}] Order context:`, {
    tier: context.customer_tier,
    attempts: context.delivery_attempts,
    hazmat: context.contains_hazmat,
    perishable: context.is_perishable
  });

  // ========================================================================
  // 3. APPLY SHORT CIRCUIT RULES (Avoid LLM when possible)
  // ========================================================================
  const shortCircuit = await applyShortCircuitRules(input, context);

  if (shortCircuit.action !== 'no_short_circuit') {
    console.log(`[${requestId}] SHORT CIRCUIT: ${shortCircuit.action} - ${shortCircuit.reason}`);

    // Log the short-circuit decision
    await logDecision(input.order_id, input, {
      type: 'short_circuit',
      action: shortCircuit.action,
      reason: shortCircuit.reason
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        order_id: input.order_id,
        decision_type: 'short_circuit',
        action: shortCircuit.action,
        reason: shortCircuit.reason,
        confidence: shortCircuit.confidence,
        cost_saved: 'LLM call avoided',
        message: 'Business rule applied - no AI agent needed'
      })
    };
  }

  console.log(`[${requestId}] No short circuit applied - proceeding to guardrails`);

  // ========================================================================
  // 4. APPLY BEDROCK GUARDRAILS (PII, profanity, attacks)
  // ========================================================================
  const guardrailResult = await applyGuardrails(input.notes);

  if (!guardrailResult.passed) {
    console.warn(`[${requestId}] Guardrails blocked content:`, guardrailResult.violations);
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Content policy violation',
        details: guardrailResult.violations,
        message: 'Input blocked by content safety guardrails'
      })
    };
  }

  console.log(`[${requestId}] Guardrails passed - content is safe`);
  const sanitizedNotes = guardrailResult.sanitizedText || input.notes;

  // ========================================================================
  // 5. COMPOSE PROMPT AND INVOKE AGENT
  // ========================================================================
  const prompt = composeAgentPrompt(input, context, sanitizedNotes);
  const sessionId = `${input.order_id}-${Date.now()}`;

  console.log(`[${requestId}] Invoking agent with session: ${sessionId}`);

  try {
    const { response: agentResponse, traces } = await invokeAgent(prompt, sessionId);

    console.log(`[${requestId}] Agent completed successfully`);

    // Log the agent decision
    await logDecision(input.order_id, input, {
      type: 'agent_decision',
      action: 'agent_executed',
      reason: 'Complex scenario required AI analysis',
      agentResponse,
      traces
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        order_id: input.order_id,
        decision_type: 'agent_decision',
        session_id: sessionId,
        agent_response: agentResponse,
        message: 'AI agent triage completed successfully'
      })
    };

  } catch (error: any) {
    console.error(`[${requestId}] Agent invocation failed:`, error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Agent invocation failed',
        message: error.message
      })
    };
  }
};
