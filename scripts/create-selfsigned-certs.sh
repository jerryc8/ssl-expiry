#/bin/sh
# takes ip addresses from stdin and create folders
# with private keys and certificates inside, execute as:
#   $ cat ./ip_addresses.txt | ./scripts/create-selfsigned-certs.sh
while read address; do
  if echo "$address"| grep -Eq "^10.10.6.[0-9]*$"
  then
      servicename='europa'
  else
      servicename='callisto'
  fi
  echo "Generating config for $servicename-$address"
  validity=29
  mkdir -p nginx-confd/$servicename-$address
  # inspired by https://serverfault.com/a/650008
  openssl genrsa -aes256 -out /tmp/client1.key -passout pass:client11 2048
  openssl rsa -in /tmp/client1.key -passin pass:client11 -out nginx-confd/$servicename-$address/server.key
  openssl req -new -key /tmp/client1.key -subj req -new -passin pass:client11 -out /tmp/client1.csr -subj "/C=US/ST=TX/L=/O=Test/OU=/CN=$servicename-$address"
  openssl x509 -passin pass:client11 -signkey /tmp/client1.key -in /tmp/client1.csr -req -days $validity -dates -out nginx-confd/$servicename-$address/server.crt
  rm /tmp/client1.key /tmp/client1.csr
  echo 'server {
    listen 443;
    server_name  localhost;

    ssl_certificate /etc/nginx/conf.d/server.crt;
    ssl_certificate_key /etc/nginx/conf.d/server.key;

    ssl on;
    ssl_session_cache  builtin:1000  shared:SSL:10m;
    ssl_protocols  TLSv1 TLSv1.1 TLSv1.2;
    ssl_ciphers HIGH:!aNULL:!eNULL:!EXPORT:!CAMELLIA:!DES:!MD5:!PSK:!RC4;
    ssl_prefer_server_ciphers on;

    location / {
        root   /usr/share/nginx/html;
        index  index.html index.htm;
    }

    error_page   500 502 503 504  /50x.html;
    location = /50x.html {
        root   /usr/share/nginx/html;
    }
}' > nginx-confd/$servicename-$address/default.conf
done
