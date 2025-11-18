const ExcelJS = require("exceljs");
const fs = require("fs");
const path = require("path");

const EXCEL_FILE = path.join(__dirname, "excel", "pulls.xlsx");
const workbook = new ExcelJS.Workbook();

async function initWorkbook() {
  if (!fs.existsSync(path.dirname(EXCEL_FILE))) fs.mkdirSync(path.dirname(EXCEL_FILE), { recursive: true });
  if (fs.existsSync(EXCEL_FILE)) await workbook.xlsx.readFile(EXCEL_FILE);
}

function getSheet(streamer) {
  let sheet = workbook.getWorksheet(streamer);
  if (!sheet) {
    sheet = workbook.addWorksheet(streamer);
    sheet.addRow(["Timestamp","Streamer","Rarity","Stars","Fish Name","Weight","Gold","Total Gold","Heaviest Fish","Highest Weight"]);
  }
  return sheet;
}

async function logToExcel(streamer, pull) {
  const sheet = getSheet(streamer);
  sheet.addRow([
    pull.timestamp,
    streamer,
    pull.rarity,
    pull.stars,
    pull.fishName,
    pull.weight,
    pull.gold,
    pull.totalGold,
    pull.heaviestFish,
    pull.highestWeight
  ]);
  await workbook.xlsx.writeFile(EXCEL_FILE);
}

module.exports = { initWorkbook, logToExcel };
