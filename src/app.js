import fs from "fs";
import readline from "readline";
import { StatsD } from "hot-shots";
import { IncomingWebhook } from "@slack/webhook";
import sslChecker from "ssl-checker";

// Certificates are issued Thursdays UTC at unspecified time, but they should
// already be valid from midnight Thursdays
const EXPECTED_ISSUE_WEEKDAY = 'Thurs';
const SERVER_ADDRESSES = 'ip_addresses.txt';
const SLACK_WEBHOOK_URL = 'https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX';
const STATSD_ADDRESS = '10.10.4.14';
const STATSD_PORT = 8125;
const URGENT_EXPIRE_SOON_LIMIT_DAYS = 30;

const DISABLE_SLACK = process.env.DISABLE_SLACK;

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

const webhook = new IncomingWebhook(SLACK_WEBHOOK_URL);
const notifyBySlack = async (urgency, message) => {
  console.log('slack-notify:', urgency, message);
  let text = message;
  if (urgency === 'urgent') {
    text = `URGENT: ${message}`;
  } else if (urgency === 'extreme') {
    text = `EXTREMELY URGENT! ${message}`;
  }
  if (DISABLE_SLACK) {
    console.log(text);
  } else {
    await webhook.send({ text });
  }
};

const checkServer = async (address) => {
  let sslPort = 443;
  let service = 'Unknown';
  // TOIMPROVE: use `ip-subnet-calculator` package instead, string comparison
  // is hacky because it works only because of /24
  if (address.startsWith('10.10.6.')) {
    service = 'Europa';
    sslPort = 4000;
  } else if (address.startsWith('10.10.8.')) {
    service = 'Callisto';
    sslPort = 8000;
  }

  let result = null;
  try {
    result = await sslChecker(address, { method: "GET", port: sslPort });
  } catch (error) {
    await notifyBySlack('urgent', `Unable to connect to ${address}, error: ${error}`);
    return { service, problem: 'unconnectable' };
  }

  // Both the ssl-checker return value and new Date() are in UTC
  // Hence there is no need to account for timezone difference

  // eg, validTo: "2023-05-03T04:36:29.000Z"
  const now = new Date();
  const expiryDate = new Date(Date.parse(result.validTo));
  const diffTime = expiryDate - now;
  if (diffTime < 0) {
    await notifyBySlack('extreme', `Certificate for server ${address} expired on: ${expiryDate.toISOString()}, please re-issue immediately`);
    return { service, problem: 'expired' };
  }

  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  if (diffDays > URGENT_EXPIRE_SOON_LIMIT_DAYS) {
    await notifyBySlack('urgent', `Certificate for server ${address} expiring soon (< ${URGENT_EXPIRE_SOON_LIMIT_DAYS} days): ${expiryDate.toISOString()}`);
    return { service, problem: 'expiring' };
  }
  // eg, validFrom: "2023-02-08T04:36:30.000Z"
  const issueDate = new Date(Date.parse(result.validFrom));
  const expectedIssueDate = getLastDayOccurence(now, EXPECTED_ISSUE_WEEKDAY);
  if (issueDate < expectedIssueDate) {
    await notifyBySlack('normal', `Certificate for server ${address} is outdated, issued: ${issueDate.toISOString()} (expected ${expectedIssueDate.toISOString()} or later)`);
    return { service, problem: 'outdated' };
  }
  // still considered healthy even if recent issuance did not happen
  return { service, problem: null };
};

// TOIMPROVE - if file is large, use `line-by-line` package to avoid
// loading the entire file into memory
const readInterface = readline.createInterface({
  input: fs.createReadStream(SERVER_ADDRESSES)
});
// TOIMPROVE - possible to batch parallelize the checks
const unhealthyCounts = {};
for await (const line of readInterface) {
  const {service, problem} = await checkServer(line);
  if (problem) {
    const key = `${service}.${problem}`;
    const count = unhealthyCounts[key];
    if (Number.isInteger(count)) {
      unhealthyCounts[key] += 1;
    } else {
      unhealthyCounts[key] = 1;
    }
  }
}
console.log('debug: for statsd: ', unhealthyCounts);
// record how many unhealthy instances exist for each service
const client = new StatsD(
  {
      host: STATSD_ADDRESS,
      port: STATSD_PORT
  }
);
for (const statskey of Object.keys(unhealthyCounts)) {
  const c = unhealthyCounts[statskey];
  console.log(`stat ${statskey}: ${c} unhealthy`);
  client.gauge(`cert.${statskey}`, c);
}
