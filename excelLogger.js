const ExcelJS = require("exceljs");
const fs = require("fs");
const path = require("path");
const { logWithTime } = require("./logger");

const EXCEL_FILE = path.join(__dirname, "excel", "pulls.xlsx");
const workbook = new ExcelJS.Workbook();
const pendingRows = {};
let saveTimeout = null;
const SAVE_INTERVAL = 5000;

async function initWorkbook() {
  if (!fs.existsSync(path.dirname(EXCEL_FILE))) fs.mkdirSync(path.dirname(EXCEL_FILE), { recursive: true });
  if (fs.existsSync(EXCEL_FILE)) await workbook.xlsx.readFile(EXCEL_FILE);
}

function getSheet(streamer) {
  const dateSuffix = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  const sheetName = `${streamer}-${dateSuffix}`;
  let sheet = workbook.getWorksheet(sheetName);
  if (!sheet) {
    sheet = workbook.addWorksheet(sheetName);
    sheet.addRow(["Timestamp","Streamer","Rarity","Stars","Fish Name","Weight","Gold","Total Gold","Heaviest Fish","Highest Weight"]);
  }
  return sheet;
}

function logToExcel(streamer, pull) {
  if (!pendingRows[streamer]) pendingRows[streamer] = [];
  pendingRows[streamer].push([
    pull.timestamp, streamer, pull.rarity, pull.stars, pull.fishName,
    pull.weight, pull.gold, pull.totalGold, pull.heaviestFish, pull.highestWeight
  ]);

  if (!saveTimeout) {
    saveTimeout = setTimeout(async () => {
      for (const s in pendingRows) {
        const sheet = getSheet(s);
        pendingRows[s].forEach(row => sheet.addRow(row));
        pendingRows[s] = [];
      }
      await workbook.xlsx.writeFile(EXCEL_FILE);
      logWithTime(`[Excel] Saved workbook`);
      saveTimeout = null;
    }, SAVE_INTERVAL);
  }
}

module.exports = { initWorkbook, logToExcel };
