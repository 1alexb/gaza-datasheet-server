// seed_categories.js
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

// Path to database
const filePath = path.resolve(__dirname, 'data/gaza_timemap.xlsx');

console.log(`Targeting file: ${filePath}`);

if (!fs.existsSync(filePath)) {
  console.error("Error: File not found!");
  process.exit(1);
}

// 1. Read the Workbook
const workbook = XLSX.readFile(filePath);

// 2. Define the Timemap Schema 
// Columns: id, title, desc, mode, filter_path0, filter_path1, filter_path2
const headers = ['id', 'title', 'desc', 'mode', 'filter_path0', 'filter_path1', 'filter_path2'];

// 3. Define the New Categories
const categories = [
  // ID            Title          Description                 Mode      Path0   Path1           Path2
  ['casualties',   'Casualties',  'Reports of killed/injured', 'FILTER', 'Type', 'Casualties',   ''],
  ['humanitarian', 'Humanitarian','Aid and Situation Reports', 'FILTER', 'Type', 'Humanitarian', '']
];

// 4. Convert to Worksheet
const wsData = [headers, ...categories];
const newSheet = XLSX.utils.aoa_to_sheet(wsData);

// 5. Overwrite the EXPORT_ASSOCIATIONS tab
workbook.Sheets['EXPORT_ASSOCIATIONS'] = newSheet;
if (workbook.Sheets['Associations']) {
    workbook.Sheets['Associations'] = newSheet;
}

// 6. Save the file
try {
  XLSX.writeFile(workbook, filePath);
  console.log("✅ Success! Categories injected into EXPORT_ASSOCIATIONS.");
  console.log("   - Added: Casualties");
  console.log("   - Added: Humanitarian");
} catch (err) {
  console.error("Failed to write file. Is it open?");
  console.error(err.message);
}