import "server-only";

import { appOrigin } from "@/server/env";
import { sendMail } from "@/server/mail/send";
import { button, layout, textLine } from "@/server/mail/template";

export async function sendWelcomeEmail(email: string) {
  await sendMail({
    to: email,
    subject: "You're on the Cirqoo list",
    html: layout({
      preheader: "We'll let you know when the next event goes on sale.",
      body: `
        ${textLine("Hi there,")}
        ${textLine("You're on the list.", { weight: 500 })}
        ${textLine("Thanks for signing up. You'll hear from us when tickets for the next Cirqoo After Hours go on sale, plus the occasional event you might like.", { size: 12 })}
        ${button("See what's on", appOrigin() || "/")}
        ${textLine("If you didn't sign up, you can ignore this email.", { size: 12, color: "#1F242F", margin: "16px 0 0" })}
      `,
    }),
  });
}
