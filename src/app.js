import fs from "fs";
import readline from "readline";
// import { StatsD } from "node-statsd";
import sslChecker from "ssl-checker";


// from https://stackoverflow.com/a/59144918
/**
 * @param {Date} date - the initial Date
 * @param {('Mon'|'Tue'|'Wed'|'Thurs'|'Fri'|'Sat'|'Sun')} day - the day of week
 * @returns {Date} - the Date of last occurrence or same Date if day param is invalid
 */
 function getLastDayOccurence (date, day) {
  let d = new Date(date.getTime());
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thurs', 'Fri', 'Sat'];
  if (days.includes(day)) {
    const modifier = (d.getDay() + days.length - days.indexOf(day)) % 7 || 7;
    d.setDate(d.getDate() - modifier);
    // use UTC midnight on the designated day
    const utc = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0);
    d = new Date(utc);
  }
  return d;
}

const notifyBySlack = async (urgency, message) => {
  // TODO: implement webhook
  console.log('notify invoked (to be implemented', urgency, message);
};

// Certificates are issued Thursdays UTC at unspecified time, but they should
// already be valid from midnight Thursdays
const EXPECTED_ISSUE_WEEKDAY = 'Thurs';
const URGENT_EXPIRE_SOON_LIMIT_DAYS = 30;

const checkServer = async (address) => {
  let sslPort = 443;
  // TOIMPROVE: string comparison works only because of /24, use an IP address library instead
  if (address.startsWith('10.10.6.')) {
    // Europa
    sslPort = 4000;
  } else if (address.startsWith('10.10.8.')) {
    // Callisto
    sslPort = 8000;
  }
  // TODO: connection issues - ensure that the team is notified.
  const result = await sslChecker(address, { method: "GET", port: sslPort });
  console.log(`ssl-checker ${address}: `, result);

  // Both the ssl-checker return value and new Date() are in UTC
  // Hence there is no need to account for timezone difference

  // eg, validFrom: "2023-02-08T04:36:30.000Z"
  const now = new Date();
  const issueDate = new Date(Date.parse(result.validFrom));
  const expectedIssueDate = getLastDayOccurence(now, EXPECTED_ISSUE_WEEKDAY);
  if (issueDate < expectedIssueDate) {
    await notifyBySlack('normal', `Certificate for server ${address} were not re-issued, issued: ${issueDate.toISOString()} (expected ${expectedIssueDate.toISOString()} or later)`);
  }

  // eg, validTo: "2023-05-03T04:36:29.000Z"
  const expiryDate = new Date(Date.parse(result.validTo));
  const diffTime = expiryDate - now;
  if (diffTime < 0) {
    await notifyBySlack('extreme', `Certificate for server ${address} expired on: ${issueDate.toISOString()}, please re-issue immediately`);
  }

  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  if (diffDays > URGENT_EXPIRE_SOON_LIMIT_DAYS) {
    await notifyBySlack('urgent', `Certificate for server ${address} will expire (< 30 days): ${issueDate.toISOString()}`);
  }
};

const SERVER_ADDRESSES = 'ip_addresses.txt';
const readInterface = readline.createInterface({
  input: fs.createReadStream(SERVER_ADDRESSES)
});
// TOIMPROVE - possible to batch parallelize the checks
for await (const line of readInterface) {
  console.log('checking address: ', line);
  await checkServer(line);
}
