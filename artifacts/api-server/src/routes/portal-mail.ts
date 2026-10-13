// No email service is connected yet. Until one is chosen, "sending" writes the message to the server log
// and reports sent:false, so the admin screen can show the preview instead of pretending it was delivered.
export type Mail = { to: string; subject: string; body: string };

export async function sendMail(mail: Mail): Promise<{ sent: boolean }> {
  console.log(`[portal] (email not sent — no email service connected) to=${mail.to} subject=${JSON.stringify(mail.subject)}`);
  return { sent: false };
}

export type WelcomeCopy = { subject: string; body: string };

// Placeholders: {{name}} {{tag}} {{code}} {{link}}. Text in [square brackets] is a gap for an admin to fill in.
export const DEFAULT_WELCOME: WelcomeCopy = {
  subject: "Welcome to Subvisual and Office 42",
  body: `Hi {{name}},

Welcome to Subvisual and to our office in Braga.

Our office is a place we like to keep special, and we want everyone to feel at home here. This tool is there to make that easier. It explains what you can do in the office and in the tool, how access works, and the guides that exist to help you get started.

Getting started
- Sign in here (the link works once and lasts 7 days; you can set a password afterwards): {{link}}
- Seating is free: pick any desk that's available.
- In the tool you can book rooms, see what is happening in the office, report issues and ask for what you need.
- Coffee, fridge, microwave and other practical info: [add where things are].
- Need equipment? [add how to request it].
- Guides and videos on how to open the door and use the tool are in your Personal area.

Access
- You'll get an email from MyJABLOTRON about the alarm. Get the MyJABLOTRON app: https://www.jablotron.com/en/products-and-services/security-systems/alarms/myjablotron-2.0 and the web self-service: https://www.jablonet.net/
- Your tag number: {{tag}}
- Your code: {{code}} (it may not be active yet; the office manager will confirm once it is)

Ideas for improving the office, issues, or suggestions for the app itself? Talk to us or leave a message in the tool. We'd like to hear them.

See you at the office!`,
};

export function renderWelcome(copy: WelcomeCopy, vars: { name: string; tag: string; code: string; link: string }): WelcomeCopy {
  const fill = (t: string) => t.replace(/\{\{(name|tag|code|link)\}\}/g, (_m, k: keyof typeof vars) => vars[k]);
  return { subject: fill(copy.subject), body: fill(copy.body) };
}
