#/bin/sh
# takes ip addresses from stdin and create text to paste into
# docker-compose.yml to stdout
#   $ cat ./ip_addresses.txt | ./scripts/create-compose-fragment.sh
while read address; do
  if echo "$address"| grep -Eq "^10.10.6.[0-9]*$"
  then
      servicename='europa'
  else
      servicename='callisto'
  fi
  echo "  $servicename-$address:
    container_name: $servicename-$address
    image: nginx
    networks:
      testenv:
        ipv4_address: $address
    volumes:
      - /opt/ssl-expiry/nginx-confd/$servicename-$address:/etc/nginx/conf.d
  "
done
