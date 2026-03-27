import twilio from "twilio";

export async function sendWhatsApp(body: string): Promise<void> {
  const client = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
  );
  await client.messages.create({
    from: process.env.TWILIO_WHATSAPP_NUMBER!,
    to: process.env.MY_WHATSAPP_NUMBER!,
    body,
  });
}
