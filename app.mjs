import fs from "fs";
import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

const openai = new OpenAI(process.env.OPENAI_API_KEY);

async function convertAudioToText(filePath) {
  try {
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(filePath),
      model: "whisper-1",
    });

    console.log(transcription.text);
  } catch (error) {
    console.error("Error during transcription:", error);
  }
}

async function main() {
  const filePath = "audio.mp3"; // Ensure this path is correct and the file exists

  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }

  await convertAudioToText(filePath);
}

main();