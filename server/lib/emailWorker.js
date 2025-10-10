const pool = require("./db");
const nodemailer = require("nodemailer");

const smtpPort = Number(process.env.SMTP_PORT || 587);

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: smtpPort,
  secure: smtpPort === 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const MAIL_FROM =
  process.env.SMTP_FROM ||
  (process.env.SMTP_USER
    ? `"CCIS Tickets" <${process.env.SMTP_USER}>`
    : '"CCIS Tickets" <no-reply@ccis.edu.ph>');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseAttachments(raw) {
  if (!raw) return undefined;
  try {
    const value = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (Array.isArray(value)) {
      return value.map((item) => ({ ...item }));
    }
  } catch (err) {
    console.warn("Failed to parse attachments", err.message);
  }
  return undefined;
}

async function processPendingEmails(limit = 200) {
  const [rows] = await pool.query(
    'SELECT * FROM email_queue WHERE status = "pending" ORDER BY created_at LIMIT ?',
    [limit]
  );

  if (rows.length === 0) {
    return { pending: 0, sent: 0, failed: 0 };
  }

  let sent = 0;
  let failed = 0;

  for (const mail of rows) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [updateResult] = await connection.query(
        'UPDATE email_queue SET status = "sending", tries = tries + 1, last_attempt = ? WHERE id = ? AND status = "pending"',
        [new Date(), mail.id]
      );

      if (updateResult.affectedRows === 0) {
        await connection.rollback();
        continue;
      }

      const attachments = parseAttachments(mail.attachments);

      await transporter.sendMail({
        from: MAIL_FROM,
        to: mail.to_name
          ? { name: mail.to_name, address: mail.to_email }
          : mail.to_email,
        subject: mail.subject,
        html: mail.body,
        attachments,
      });

      await connection.query(
        'UPDATE email_queue SET status = "sent" WHERE id = ?',
        [mail.id]
      );
      await connection.commit();
      sent += 1;
    } catch (err) {
      console.error("Error sending email", mail.id, err.message);
      failed += 1;
      try {
        await connection.query(
          'UPDATE email_queue SET status = "failed" WHERE id = ?',
          [mail.id]
        );
        await connection.commit();
      } catch (commitErr) {
        console.error("Failed to mark email as failed", commitErr.message);
        await connection.rollback();
      }
    } finally {
      connection.release();
    }
  }

  return { pending: rows.length, sent, failed };
}

async function runBatchWorker() {
  while (true) {
    const result = await processPendingEmails();
    if (result.pending === 0) {
      await sleep(5000);
    }
  }
}

module.exports = { runBatchWorker, processPendingEmails };
