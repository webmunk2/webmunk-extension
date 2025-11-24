import { onRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { AzureOpenAI, OpenAI } from 'openai';

const OPENAI_API_KEY = defineSecret('OPENAI_API_KEY');
const AZURE_API_KEY = defineSecret('AZURE_OPENAI_API_KEY');
const AZURE_ENDPOINT = defineSecret('AZURE_OPENAI_ENDPOINT'); 
const MODEL_NAME = 'gpt-5'; 
const AZURE_API_VERSION = '2025-04-01-preview';

export const analyzeScreenshot = onRequest(
  { secrets: [OPENAI_API_KEY, AZURE_API_KEY, AZURE_ENDPOINT] },
  async (req, res) => {
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

    const prompt = `You are given a screenshot of a website. Your task is to identify, count, and summarize every advertisement on the page.
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
 - Do not include any explanations, quotes, or new lines — return the formatted output only.`;

    async function callAzure() {
      const client = new AzureOpenAI({
        endpoint: AZURE_ENDPOINT.value(), 
        apiKey: AZURE_API_KEY.value(),
        apiVersion: AZURE_API_VERSION,
      });

      const response = await client.chat.completions.create({
        model: MODEL_NAME,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: dataUrl, detail: 'low' } },
            ]
          }
        ],
      });

      return response.choices[0].message.content;
    }

    async function callOpenAI() {
      const client = new OpenAI({ apiKey: OPENAI_API_KEY.value() });
      const response = await client.responses.create({
        model: MODEL_NAME,
        input: [
          {
            role: 'user',
            content: [
              { type: 'input_text', text: prompt },
              { type: 'input_image', image_url: dataUrl, detail: 'low' },
            ],
          },
        ],
      });
      
      return response.output_text;
    }

    try {
      let result;
      try {
        result = await callAzure();
      } catch (err: any) {
        result = await callOpenAI();
      }

      res.status(200).json({ result });
    } catch (err) {
      console.error('FINAL ERROR:', err);
      res.status(500).json({ error: 'Internal server error'});
    }
  }
);
