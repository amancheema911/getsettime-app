/**
 * WhatsApp Webhook Handler
 * 
 * SETUP INSTRUCTIONS:
 * 
 * 1. Set up environment variable:
 *    Add to your .env file:
 *    WHATSAPP_WEBHOOK_VERIFY_TOKEN=your_secret_token_here
 * 
 * 2. Configure webhook in Meta Business Manager:
 *    - Go to Meta Business Manager > WhatsApp > Configuration > Webhooks
 *    - Click "Edit" on your webhook
 *    - Callback URL: https://yourdomain.com/api/whatsapp/webhook
 *    - Verify Token: (use the same value as WHATSAPP_WEBHOOK_VERIFY_TOKEN)
 *    - Subscribe to: messages
 *    - Click "Verify and Save"
 * 
 * 3. Meta will call GET /api/whatsapp/webhook to verify
 *    - If successful, you'll see "✅ Webhook verification successful!" in logs
 *    - If failed, check the error message in logs to see what's wrong
 * 
 * 4. Once verified, Meta will send POST requests to this endpoint
 *    when users send messages to your WhatsApp Business number
 */

import { NextResponse } from "next/server";
import { sendWhatsAppMessage } from "@workspace/lib/whatsapp";

const VERIFY_TOKEN = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;

/**
 * GET: Verification endpoint for WhatsApp Cloud API webhook
 * Meta will call this once when you configure the webhook.
 * 
 * How it works:
 * 1. Meta sends: ?hub.mode=subscribe&hub.verify_token=YOUR_TOKEN&hub.challenge=RANDOM_STRING
 * 2. You verify the token matches your WHATSAPP_WEBHOOK_VERIFY_TOKEN
 * 3. You return the challenge string to complete verification
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  // Log all incoming parameters for debugging
  console.log("Webhook verification request:", {
    mode,
    tokenReceived: token ? "***" + token.slice(-4) : "missing",
    challenge: challenge ? "present" : "missing",
    verifyTokenConfigured: VERIFY_TOKEN ? "yes" : "no"
  });

  // Check if verify token is configured
  if (!VERIFY_TOKEN) {
    console.error("❌ WHATSAPP_WEBHOOK_VERIFY_TOKEN is not configured in environment variables");
    return NextResponse.json(
      { 
        error: "Webhook verify token not configured",
        message: "Please set WHATSAPP_WEBHOOK_VERIFY_TOKEN in your .env file"
      },
      { status: 500 }
    );
  }

  // Verify all required parameters
  if (mode !== "subscribe") {
    console.error("❌ Invalid mode:", mode, "(expected: 'subscribe')");
    return NextResponse.json(
      { 
        error: "Invalid mode",
        received: mode,
        expected: "subscribe"
      },
      { status: 403 }
    );
  }

  if (!token) {
    console.error("❌ Missing hub.verify_token parameter");
    return NextResponse.json(
      { error: "Missing verify token" },
      { status: 403 }
    );
  }

  if (token !== VERIFY_TOKEN) {
    console.error("❌ Token mismatch:", {
      received: "***" + token.slice(-4),
      expected: "***" + VERIFY_TOKEN.slice(-4)
    });
    return NextResponse.json(
      { 
        error: "Token mismatch",
        message: "The verify token does not match WHATSAPP_WEBHOOK_VERIFY_TOKEN"
      },
      { status: 403 }
    );
  }

  if (!challenge) {
    console.error("❌ Missing hub.challenge parameter");
    return NextResponse.json(
      { error: "Missing challenge" },
      { status: 403 }
    );
  }

  // All checks passed - return challenge to complete verification
  console.log("✅ Webhook verification successful!");
  return new Response(challenge, {
    status: 200,
    headers: {
      "Content-Type": "text/plain",
    },
  });
}

/**
 * POST: Receive incoming WhatsApp messages and send a reply
 * This uses your existing sendWhatsAppMessage helper and token handling.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();

    console.log(
      "Incoming WhatsApp webhook payload:",
      JSON.stringify(body, null, 2)
    );

    // Basic validation – ignore non-WhatsApp business events
    if (body.object !== "whatsapp_business_account") {
      return NextResponse.json({ received: true }, { status: 200 });
    }

    const entries = body.entry || [];

    for (const entry of entries) {
      const changes = entry.changes || [];

      for (const change of changes) {
        const value = change.value || {};
        const messages = value.messages || [];

        for (const message of messages) {
          const from = message.from;
          const msgBody = message.text?.body || "";

          if (!from || !msgBody) {
            continue;
          }

          console.log("Processing incoming message from:", from, msgBody);

          try {
            // Simple auto‑reply – customize as needed
            await sendWhatsAppMessage(
              from,
              `Thanks for your message! We received: "${msgBody}"`
            );
          } catch (err) {
            console.error("Failed to send WhatsApp auto-reply:", err);
          }
        }
      }
    }

    // Always return 200 so Meta treats the webhook as delivered
    return NextResponse.json({ received: true }, { status: 200 });
  } catch (err) {
    console.error("Error handling WhatsApp webhook:", err);
    return NextResponse.json(
      { error: "Error handling WhatsApp webhook" },
      { status: 500 }
    );
  }
}