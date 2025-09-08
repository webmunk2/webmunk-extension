import { onRequest } from 'firebase-functions/v2/https';
import fetch from 'node-fetch';

export const analyzeScreenshot = onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  const { dataUrl } = req.body;

  if (!dataUrl) {
    res.status(400).json({ error: 'Missing dataUrl' });
    return;
  }

  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

  try {
    const openAiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `You are given a screenshot of a website. Your task is to identify, count, and summarize every advertisement on the page.
Definition: An advertisement is any sponsored, promotional, or paid element intended to sell a product or service. Indicators of ads are labels like 'Sponsored' or 'Ad'.
Ad grouping rules:
 - If each product has its own distinct ad label, count each one as a separate ad unit.
 - If multiple products appear together in one section or carousel that has a single 'Sponsored' or ad label nearby, count it as one ad unit.
 - If a label is positioned above or beside a group when individual products are not labeled, assume it applies to the whole group.
For each ad, please identify the brand associated with the ad and summarize the information content of the ad. If it contains a price, please also determine its price.
Return your output in exactly this format, as one line with no line breaks or extra text: [TOTAL]+---+[AD1]+---+[AD2]+---+...+[ADN]
 - Replace [TOTAL] with the number of ads you found.
 - Replace [AD1], [AD2], etc. with each ad identified. For [AD1], please format the output as brand || description of the content || price
 - Use +---+ exactly as the separator between all parts.
 - If there are no ads, return exactly: 0
 - Do not include any explanations, quotes, or new lines — return the formatted output only.`,
              },
              {
                type: 'image_url',
                image_url: {
                  url: dataUrl,
                },
              },
            ],
          },
        ],
        max_tokens: 500,
      }),
    });

    const data = await openAiResponse.json();
    const result = data.choices?.[0]?.message?.content;

    res.status(200).json({ result });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});
