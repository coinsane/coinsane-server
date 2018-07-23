#!/bin/bash 
set -e

# variables
docker_image=$1

container_tmpl="backend-"

int_port=8080
main_port=8080
backup_port=9090

nginx_conf_dir="/etc/nginx/sites-available"
nginx_tmpl="backend.tmpl"
nginx_conf="backend.conf"

HTTP_CODE="404"

# functions
function start_container {
	local port=$1

	docker run -d -p $port:$int_port --restart always --env-file /tmp/.env --name "${container_tmpl}${port}" "$docker_image"
	sleep 2
	CODE=$(curl --fail --silent --max-time 2 --write-out "%{http_code}" http://127.0.0.1:$port/ || true)
	if [ $CODE == $HTTP_CODE ]; then
		sed -e "s/%PORT%/$port/" $nginx_conf_dir/$nginx_tmpl > $nginx_conf_dir/$nginx_conf
		nginx -t &>/dev/null
		if [ $? -eq 0 ]; then 
			systemctl reload nginx
		else
			echo "Something goes wrong."
			exit 1
		fi
	fi
}

function stop_container {
	local port="$1"

	docker stop "${container_tmpl}${port}"
	docker rm "${container_tmpl}${port}"
}

function get_another_port {
	local port=$1

	if [ $port == $main_port ]; then
		return_port=$backup_port
	elif [ $port == $backup_port ]; then
		return_port=$main_port
	else
		echo "can't find external port, exiting..."
		exit 1
	fi

	echo "$return_port"
}

# main

# find full container name based on the template
container_name=$(docker ps --format "{{.Names}}" --filter "name=$container_tmpl")

# if we don't have any container with the backend - start a new one and exit.
if [ -z "$container_name" ]; then
	start_container "$main_port"
	exit 0
fi

# find current external port number
current_port=$(docker port $container_name $int_port/tcp | awk -F: '{print $2}')
if [ -z $current_port ]; then
	echo "can't find external port, exiting..."
	exit 1
fi

# start a new container
port=$(get_another_port $current_port)
start_container $port

# stop an old container
port=$(get_another_port $port)
stop_container $port

exit 0
