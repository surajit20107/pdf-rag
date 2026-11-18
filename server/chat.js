import { OpenAI } from "openai";

const openai = new OpenAI({
  baseURL: "https://api.bluesminds.com/v1",
  apiKey: process.env.OPENAI_API_KEY,
});

// console.log(process.env.OPENAI_API_KEY);


export async function getFinalResponse(userQuery, chunks) {
  const SYSTEM_PROMPT = `You are a helpful ai assistant who answers the user's question based on the provided context.
    context: ${JSON.stringify(chunks)}
    `;

  const chatResponse = await openai.chat.completions.create({
    model: "deepseek-v4.1-flash-uncen",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userQuery },
    ],
  });

  return chatResponse.choices[0].message.content;
}
