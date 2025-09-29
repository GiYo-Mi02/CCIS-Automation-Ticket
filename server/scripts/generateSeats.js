require("dotenv").config();
const mysql = require("mysql2/promise");

const DB = {
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASS || "",
  database: process.env.DB_NAME || "ccis_ticketing",
};

async function generateSeats() {
  const conn = await mysql.createConnection(DB);

  const startDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const endDate = new Date(startDate.getTime() + 2 * 60 * 60 * 1000);

  const [eventResult] = await conn.execute(
    "INSERT INTO events (name, description, poster_url, starts_at, ends_at, performance_at, capacity) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [
      "Grand Theater - Demo",
      "Initial seating 1196",
      "https://via.placeholder.com/640x960.png?text=Grand+Theater",
      startDate,
      endDate,
      startDate,
      1196,
    ]
  );

  const eventId = eventResult.insertId;

  const baseRowPattern = [
    18, 20, 22, 24, 26, 28, 30, 30, 28, 26, 24, 22, 20, 18,
  ];

  const rowLabels = [];
  for (let i = 0; i < 100; i += 1) {
    let label = "";
    let n = i;
    do {
      label = String.fromCharCode(65 + (n % 26)) + label;
      n = Math.floor(n / 26) - 1;
    } while (n >= 0);
    rowLabels.push(label);
  }

  let created = 0;
  let rowIndex = 0;
  const insertSeat =
    "INSERT INTO seats (event_id, section, row_label, seat_number, row_idx, col_idx) VALUES (?, ?, ?, ?, ?, ?)";

  while (created < 1196) {
    const patternIdx = rowIndex % baseRowPattern.length;
    let count = baseRowPattern[patternIdx];

    if (created + count > 1196) {
      count = 1196 - created;
    }

    const rowLabel = rowLabels[rowIndex];
    for (let i = 0; i < count; i += 1) {
      await conn.execute(insertSeat, [
        eventId,
        "Main",
        rowLabel,
        i + 1,
        rowIndex,
        i,
      ]);
    }

    created += count;
    rowIndex += 1;
  }

  console.log(`Created event ${eventId} with ${created} seats`);
  await conn.end();
}

generateSeats().catch((err) => {
  console.error("Seat generation failed", err);
  process.exit(1);
});
