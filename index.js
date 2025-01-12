/***** bot.js *****/
require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api"); // v0.61.0
const fs = require("fs");

// Create a new bot instance with polling
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });

// Listen for `/holders` command with rune name and amount
// Usage: /holders THE•ORDZAAR•RUNES 40000000000000
bot.onText(/\/holders (.+) (\d+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id; // the user issuing the command

  // Destructure the extracted arguments
  let runeName = match[1]; // e.g. THE•ORDZAAR•RUNES
  let thresholdAmount = match[2]; // e.g. 40000000000000 (string)

  // Optional: Output info to console
  console.log(
    `User ${userId} requested holders for:`,
    runeName,
    "above",
    thresholdAmount,
  );

  try {
    // Construct the API URL (encode the runeName to handle special characters)
    const API_URL = `https://api.unisat.space/query-v4/runes/${encodeURIComponent(runeName)}/holders?start=0&limit=500`;

    // Fetch data from the API
    const response = await fetch(API_URL);
    const jsonData = await response.json();

    // If the API didn't return a valid structure
    if (!jsonData || !jsonData.data || !jsonData.data.detail) {
      throw new Error("API response structure is invalid");
    }

    const { detail } = jsonData.data;

    // Convert threshold to BigInt for comparison
    const thresholdBigInt = BigInt(thresholdAmount);

    // Filter addresses whose amount is greater than the threshold
    const filteredHolders = detail.filter(
      (item) => BigInt(item.amount) > thresholdBigInt,
    );

    // Sort descending by amount
    filteredHolders.sort((a, b) =>
      BigInt(b.amount) > BigInt(a.amount) ? 1 : -1,
    );

    // Build CSV: "Address,Amount"
    const csvHeader = "Address,Amount\n";
    const csvRows = filteredHolders
      .map(({ address, amount }) => `${address},${amount}`)
      .join("\n");
    const csvContent = csvHeader + csvRows;

    // Write to a temporary file (in real usage, might store in memory)
    const csvFilePath = `addresses_${userId}.csv`;
    fs.writeFileSync(csvFilePath, csvContent);

    // Send the CSV file back as a document
    await bot.sendDocument(
      chatId,
      csvFilePath,
      {},
      {
        filename: "addresses.csv",
        contentType: "text/csv",
      },
    );

    // Clean up - remove temp file (optional if ephemeral usage)
    fs.unlinkSync(csvFilePath);
  } catch (error) {
    console.error("Error fetching data or sending CSV:", error);
    await bot.sendMessage(chatId, `Error: ${error.message}`);
  }
});

console.log("Telegram bot is up and running...");
