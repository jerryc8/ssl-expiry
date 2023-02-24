import fs from "fs";
import readline from "readline";
// import { StatsD } from "node-statsd";
import sslChecker from "ssl-checker";

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
  const result = await sslChecker(address, { method: "GET", port: sslPort });
  console.log(result);
  // eg, validFrom: "2023-02-08T04:36:30.000Z"
  // eg, validTo: "2023-05-03T04:36:29.000Z"

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
