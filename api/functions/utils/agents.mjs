import { BedrockRuntimeClient, ConverseCommand } from "@aws-sdk/client-bedrock-runtime";
import { BedrockAgentCoreClient, ListEventsCommand, CreateEventCommand } from '@aws-sdk/client-bedrock-agentcore';

const ac = new BedrockAgentCoreClient();
const bedrock = new BedrockRuntimeClient();
const MAX_ITERATIONS = 10;
const MAX_TOKENS = 10000;

export const converse = async (model, systemPrompt, message, tools, options) => {
  let conversation = [];
  if (options?.sessionId && options?.actorId) {
    conversation = await loadConversation(options.sessionId, options.actorId);
  }
  const messages = [{ role: 'user', content: [{ text: message.parts[0].text }] }];
  let finalResponse = '';
  let iteration = 0;

  while (iteration < MAX_ITERATIONS) {
    iteration++;
    try {
      const command = new ConverseCommand({
        modelId: model,
        system: [{ text: systemPrompt }],
        messages: [...conversation, ...messages],
        ...tools.length && { toolConfig: { tools: tools.map(t => { return { toolSpec: t.spec }; }) } },
        inferenceConfig: { maxTokens: MAX_TOKENS }
      });

      const response = await bedrock.send(command);

      if (!response.output?.message?.content) {
        console.warn(`No message output on iteration ${iteration + 1}. Response:`, JSON.stringify(response, null, 2));
        break;
      }

      const messageContent = response.output.message.content;
      messages.push({ role: 'assistant', content: messageContent });

      // Check if we have tool use or just text
      const toolUseItems = messageContent.filter(item => 'toolUse' in item && !!item.toolUse);
      const textItems = messageContent.filter(item => 'text' in item && !!item.text);

      if (toolUseItems.length) {
        const message = { role: 'user', content: [] };
        for (const toolUseItem of toolUseItems) {
          const { toolUse } = toolUseItem;
          const { name: toolName, input: toolInput, toolUseId } = toolUse;

          console.info(`Iteration ${iteration + 1}: Tool called: ${toolName}`, { toolInput, toolUseId });

          let toolResult;
          try {
            const tool = tools.find(t => t.spec.name === toolName);
            if (!tool) {
              throw new Error(`Unknown tool: ${toolName}`);
            }

            if(options.publishUpdate){
              await options.publishUpdate(`Calling tool "tool.spec.name"`);
            }
            // Never allow an LLM to provide a tenant id!! Instead infer it from the code for security purposes
            if (options?.tenantId && tool.isMultiTenant) {
              toolResult = await tool.handler(options.tenantId, toolInput);
            } else {
              toolResult = await tool.handler(toolInput);
            }
          } catch (toolError) {
            toolResult = { error: toolError.message };
          }
          console.log(toolResult);
          const toolResultBlock = {
            toolUseId,
            content: [{ text: JSON.stringify(toolResult) }]
          };

          message.content.push({ toolResult: toolResultBlock });
        }
        messages.push(message);
      } else if (textItems.length > 0) {
        finalResponse = textItems.map(item => item.text).join('');
        break;
      } else {
        console.warn(`Iteration ${iteration + 1}: Unexpected content structure:`, messageContent);
        finalResponse = 'Received unexpected response type from model';
        break;
      }
    } catch (error) {
      console.error(`Error on iteration ${iteration}:`, error);
      throw new Error(`Failed to process message`);
    }
  }

  if (!finalResponse && iteration >= MAX_ITERATIONS) {
    console.warn(`Stopped due to iteration limit`);
  }

  if (!finalResponse && messages.length > 1) {
    const lastAssistantMessage = [...messages].reverse().find(m => m.role === 'assistant');
    if (lastAssistantMessage?.content) {
      const textContent = lastAssistantMessage.content
        .filter(item => 'text' in item && !!item.text)
        .map(item => item.text)
        .join('');
      if (textContent) {
        finalResponse = textContent;
      }
    }
  }

  if (options?.sessionId && options?.actorId) {
    await addToConversation(options.sessionId, options.actorId, messages);
  }
  return sanitizeResponse(finalResponse, { preserveThinkingTags: false }) || 'No response generated';
};

const loadConversation = async (sessionId, actorId) => {
  const eventsResponse = await ac.send(new ListEventsCommand({
    memoryId: process.env.MEMORY_ID,
    actorId,
    sessionId,
    includePayloads: true
  }));

  const conversation = eventsResponse.events.flatMap(e => {
    return e.payload.flatMap(msg => {
      if (msg.conversational.role === 'ASSISTANT') {
        return { role: 'assistant', content: [msg.conversational.content] };
      } else if (msg.conversational.role === 'USER') {
        return { role: 'user', content: [msg.conversational.content] };
      } else if (msg.conversational.role === 'TOOL') {
        return { role: 'user', content: [{ toolResult: JSON.parse(msg.conversational.content.text) }] };
      }
    });
  });

  return conversation ?? [];
};

const addToConversation = async (sessionId, actorId, messages) => {
  const agentCoreMessages = messages.map(message => {
    if (message.role === 'assistant') {
      return { role: 'ASSISTANT', content: { text: message.content[0].text } };
    } else if (message.role === 'user' && message.content[0].text) {
      return { role: 'USER', content: { text: message.content[0].text } };
    } else if (message.role === 'user' && message.content[0].toolResult) {
      return null; //intentionally omit tool result messages because they bloat the conversation
    }
  }).filter(msg => msg !== null);

  await ac.send(new CreateEventCommand({
    memoryId: process.env.MEMORY_ID,
    actorId,
    sessionId,
    eventTimestamp: new Date(),
    payload: agentCoreMessages.map(msg => { return { conversational: msg }; })
  }));
};

const sanitizeResponse = (text, options = {}) => {
  if (options?.preserveThinkingTags) {
    return text.trim();
  }
  return text.replace(/<thinking>[\s\S]*?<\/thinking>\s*/g, '').trim();
};
