/***** bot.js *****/
require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api"); // v0.61.0
const fs = require("fs");

// Create a new bot instance with polling
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });

// Listen for `/holders` command with rune name and amount
bot.onText(/\/holders (.+) (\d+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  let runeName = match[1]; // e.g., THE•ORDZAAR•RUNES
  let thresholdAmount = match[2]; // e.g., 40000000000000
  const thresholdBigInt = BigInt(thresholdAmount);

  console.log(
    `User ${userId} requested holders for:`,
    runeName,
    "above",
    thresholdAmount,
  );

  try {
    let allHolders = [];
    let start = 0;
    const limit = 500;
    let shouldFetch = true;

    while (shouldFetch) {
      const API_URL = `https://api.unisat.space/query-v4/runes/${encodeURIComponent(runeName)}/holders?start=${start}&limit=${limit}`;
      const response = await fetch(API_URL);
      const jsonData = await response.json();

      if (!jsonData || !jsonData.data || !jsonData.data.detail) {
        throw new Error("API response structure is invalid");
      }

      const { detail } = jsonData.data;
      const filtered = detail.filter(
        (item) => BigInt(item.amount) > thresholdBigInt,
      );

      allHolders = allHolders.concat(filtered);

      // If no more addresses in the current batch exceed the threshold, stop fetching
      if (filtered.length < limit) {
        shouldFetch = false;
      }

      // Move to the next batch
      start += limit;
    }

    // Sort all filtered holders in descending order of amount
    allHolders.sort((a, b) => (BigInt(b.amount) > BigInt(a.amount) ? 1 : -1));

    // Build CSV content
    const csvHeader = "Address,Amount\n";
    const csvRows = allHolders
      .map(({ address, amount }) => `${address},${amount}`)
      .join("\n");
    const csvContent = csvHeader + csvRows;

    // Write CSV to a temporary file
    const csvFilePath = `addresses_${userId}.csv`;
    fs.writeFileSync(csvFilePath, csvContent);

    // Send the CSV file to the user
    await bot.sendDocument(
      chatId,
      csvFilePath,
      {},
      {
        filename: "addresses.csv",
        contentType: "text/csv",
      },
    );

    // Remove the temporary CSV file
    fs.unlinkSync(csvFilePath);
  } catch (error) {
    console.error("Error fetching data or sending CSV:", error);
    await bot.sendMessage(chatId, `Error: ${error.message}`);
  }
});

console.log("Telegram bot is up and running...");
