import express from 'express';
import bodyParser from 'body-parser';
import twilio from 'twilio';
import fs from 'fs';
import axios from 'axios';
import dotenv from 'dotenv';
import OpenAI from 'openai';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;
const openai = new OpenAI(process.env.OPENAI_API_KEY);

app.use(bodyParser.urlencoded({ extended: false }));

app.post('/whatsapp', async (req, res) => {
  const mediaUrl = req.body.MediaUrl0;
  const twiml = new twilio.twiml.MessagingResponse();

  if (mediaUrl) {
    try {
      const response = await axios.get(mediaUrl, {
        responseType: 'stream',
        auth: {
          username: process.env.TWILIO_ACCOUNT_SID,
          password: process.env.TWILIO_AUTH_TOKEN
        }
      });
      const filePath = 'audio.mp3';
      const writer = fs.createWriteStream(filePath);

      response.data.pipe(writer);

      writer.on('finish', async () => {
        const transcription = await convertAudioToText(filePath);
        const correctedTranscription = await generateCorrectedTranscript(transcription);
        twiml.message(correctedTranscription);
        res.writeHead(200, { 'Content-Type': 'text/xml' });
        res.end(twiml.toString());
      });

      writer.on('error', (err) => {
        console.error('Error writing file:', err);
        twiml.message('Failed to process the audio file.');
        res.writeHead(500, { 'Content-Type': 'text/xml' });
        res.end(twiml.toString());
      });
    } catch (error) {
      console.error('Error downloading audio:', error);
      twiml.message('Failed to download the audio file.');
      res.writeHead(500, { 'Content-Type': 'text/xml' });
      res.end(twiml.toString());
    }
  } else {
    twiml.message('No audio file received.');
    res.writeHead(400, { 'Content-Type': 'text/xml' });
    res.end(twiml.toString());
  }
});

async function convertAudioToText(filePath) {
  const maxRetries = 3;
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      const transcription = await openai.audio.transcriptions.create({
        file: fs.createReadStream(filePath),
        model: 'whisper-1',
        prompt: 'The transcript is about OpenAI which makes technology like DALL·E, GPT-3, and ChatGPT with the hope of one day building an AGI system that benefits all of humanity',
      });
      return transcription.text;
    } catch (error) {
      attempt++;
      console.error(`Error during transcription (attempt ${attempt}):`, error);
      if (attempt >= maxRetries) {
        return 'Failed to transcribe the audio.';
      }
    }
  }
}

async function generateCorrectedTranscript(transcript) {
  const systemPrompt = "You are a helpful assistant for the company OpenAI. Your task is to correct any spelling discrepancies in the transcribed text. Make sure that the names of the following products are spelled correctly: DALL·E, GPT-3, ChatGPT. Only add necessary punctuation such as periods, commas, and capitalization, and use only the context provided.";

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0,
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: transcript
        }
      ]
    });
    return completion.choices[0].message.content;
  } catch (error) {
    console.error('Error during post-processing:', error);
    return transcript;
  }
}

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
}).on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${port} is already in use. Trying another port...`);
    app.listen(0, () => {
      console.log(`Server is running on port ${app.address().port}`);
    });
  } else {
    throw err;
  }
});