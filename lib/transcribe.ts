import OpenAI, { toFile } from "openai";

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _openai;
}

export async function transcribeAudio(
  mediaUrl: string,
  contentType: string
): Promise<string> {
  // Fetch the audio from Twilio (requires basic auth)
  const response = await fetch(mediaUrl, {
    headers: {
      Authorization:
        "Basic " +
        Buffer.from(
          `${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`
        ).toString("base64"),
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch audio: ${response.status}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());

  // Map content type to file extension Whisper accepts
  const ext = contentType.includes("ogg")
    ? "ogg"
    : contentType.includes("mp4") || contentType.includes("m4a")
    ? "mp4"
    : contentType.includes("mpeg") || contentType.includes("mp3")
    ? "mp3"
    : contentType.includes("webm")
    ? "webm"
    : "ogg";

  const file = await toFile(buffer, `audio.${ext}`, { type: contentType });

  const transcription = await getOpenAI().audio.transcriptions.create({
    file,
    model: "whisper-1",
    language: "pt", // Portuguese — change or remove for auto-detect
  });

  return transcription.text;
}
