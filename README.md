# Live API - Web Console

This repository contains a react-based starter app for using the [Live API](<[https://ai.google.dev/gemini-api](https://ai.google.dev/api/multimodal-live)>) over a websocket. It provides modules for streaming audio playback, recording user media such as from a microphone, webcam or screen capture as well as a unified log view to aid in development of your application.

[![Live API Demo](readme/thumbnail.png)](https://www.youtube.com/watch?v=J_q7JY1XxFE)

Watch the demo of the Live API [here](https://www.youtube.com/watch?v=J_q7JY1XxFE).

## Usage

To get started, [create a free Gemini API key](https://aistudio.google.com/apikey) and add it to the `.env` file. Then:

```
$ npm install && npm start
```

We have provided several example applications on other branches of this repository:

- [demos/GenExplainer](https://github.com/google-gemini/multimodal-live-api-web-console/tree/demos/genexplainer)
- [demos/GenWeather](https://github.com/google-gemini/multimodal-live-api-web-console/tree/demos/genweather)
- [demos/GenList](https://github.com/google-gemini/multimodal-live-api-web-console/tree/demos/genlist)

## Example

Below is an example of an entire application that will use Google Search grounding and then render graphs using [vega-embed](https://github.com/vega/vega-embed):

```typescript
import { type FunctionDeclaration, SchemaType } from '@google/generative-ai';
import { useEffect, useRef, useState, memo } from 'react';
import vegaEmbed from 'vega-embed';
import { useLiveAPIContext } from '../../contexts/LiveAPIContext';

export const declaration: FunctionDeclaration = {
  name: 'render_altair',
  description: 'Displays an altair graph in json format.',
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      json_graph: {
        type: SchemaType.STRING,
        description:
          'JSON STRING representation of the graph to render. Must be a string, not a json object',
      },
    },
    required: ['json_graph'],
  },
};

export function Altair() {
  const [jsonString, setJSONString] = useState<string>('');
  const { client, setConfig } = useLiveAPIContext();

  useEffect(() => {
    setConfig({
      model: 'models/gemini-2.0-flash-exp',
      systemInstruction: {
        parts: [
          {
            text: `**AI AGENT SYSTEM PROMPT**

You are a professional requirements analyst for a software services team. Your role is to guide visitors through a structured intake process, collect all required project details, validate information, and produce a concise, actionable summary for direct storage into the project tracking Google Sheet.

### Core Objectives

1. **Gather Complete Data** matching the Google Sheet columns:

   * \`customer_name\` (full name)
   * \`project_name\` (short title)
   * \`project_description\` (concise explanation; can combine goals, features, and constraints)
   * \`project_timeline\` (normalized to weeks or months)
   * \`project_budget\` (number, range, or bucket like \`<10k\`, \`10–25k\`, \`25–50k\`, \`50k+\`)
   * \`notes\` (extra relevant details such as must-have/nice-to-have features, integrations, risks, urgency)

2. **Validate Inputs**:

   * Name: Must not be empty.
   * Budget: Normalize to plain value or range.
   * Timeline: Normalize to weeks or months.

3. **Ask One Question at a Time**: Request only missing or invalid fields.

4. **Helpful, Concise Tone**: Keep responses under 2–3 short sentences.

5. **Structured Output**: Always return JSON with:

   * \`extraction_json\`: Matching Google Sheet fields with \`null\` for missing data.
   * \`missing_fields\`: Array of required fields still needed.
   * \`message\`: Next user-facing message.

6. **Completion Behavior**:

   * Once all required fields are collected, create a concise project summary (max 4 sentences).
   * **Immediately call the Google Sheet tool** to append a new row in the exact column order:
     \`S.No.\`, \`customer_name\`, \`project_name\`, \`project_description\`, \`project_timeline\`, \`project_budget\`, \`notes\`
     (\`S.No.\` can be blank if numbering is handled in the sheet).
   * **After Google Sheet update is confirmed**, call the Gmail tool to send a confirmation email to the customer with:

     * A thank-you note
     * Short recap of submitted details
     * Next steps or expected reply time
     * Support contact info

7. **Compliance**: Do not store or display personal data outside the defined fields.`,
          },
        ],
      },
      tools: [{ googleSearch: {} }, { functionDeclarations: [declaration] }],
    });
  }, [setConfig]);

  useEffect(() => {
    const onToolCall = (toolCall: ToolCall) => {
      console.log(`got toolcall`, toolCall);
      const fc = toolCall.functionCalls.find(
        fc => fc.name === declaration.name
      );
      if (fc) {
        const str = (fc.args as any).json_graph;
        setJSONString(str);
      }
    };
    client.on('toolcall', onToolCall);
    return () => {
      client.off('toolcall', onToolCall);
    };
  }, [client]);

  const embedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (embedRef.current && jsonString) {
      vegaEmbed(embedRef.current, JSON.parse(jsonString));
    }
  }, [embedRef, jsonString]);
  return <div className="vega-embed" ref={embedRef} />;
}
```

## development

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).
Project consists of:

- an Event-emitting websocket-client to ease communication between the websocket and the front-end
- communication layer for processing audio in and out
- a boilerplate view for starting to build your apps and view logs

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

The page will reload if you make edits.\
You will also see any lint errors in the console.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

_This is an experiment showcasing the Live API, not an official Google product. We’ll do our best to support and maintain this experiment but your mileage may vary. We encourage open sourcing projects as a way of learning from each other. Please respect our and other creators' rights, including copyright and trademark rights when present, when sharing these works and creating derivative work. If you want more info on Google's policy, you can find that [here](https://developers.google.com/terms/site-policies)._
