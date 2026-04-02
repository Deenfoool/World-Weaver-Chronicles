import "dotenv/config";
import { Telegraf, Markup } from "telegraf";

const token = process.env.TELEGRAM_BOT_TOKEN;
const miniAppUrl = process.env.MINI_APP_URL;

if (!token) {
  throw new Error("TELEGRAM_BOT_TOKEN is required");
}

if (!miniAppUrl) {
  throw new Error("MINI_APP_URL is required");
}

const bot = new Telegraf(token);

bot.start(async (ctx) => {
  await ctx.reply(
    "World Weaver Chronicles ready. Open the mini app:",
    Markup.inlineKeyboard([
      Markup.button.webApp("Play", miniAppUrl),
    ]),
  );
});

bot.command("play", async (ctx) => {
  await ctx.reply(
    "Tap to launch:",
    Markup.inlineKeyboard([
      Markup.button.webApp("Open Mini App", miniAppUrl),
    ]),
  );
});

bot.launch().then(() => {
  console.log("Telegram bot is running");
});

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
