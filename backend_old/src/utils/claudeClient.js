require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

async function askClaude(prompt, model = 'claude-3-5-sonnet-20241022') {
  try {
    const message = await client.messages.create({
      model,
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    return message.content[0].text;
  } catch (error) {
    console.error('Error calling Claude API:', error);
    throw error;
  }
}

module.exports = { askClaude, client };
