import os
import socket
import argparse
from pathlib import Path
import requests
import logging
import json

_log = logging.getLogger("main")

REGISTRAR_ADDR = "SERVICEGRAPH-REGISTRAR"

def main():
    parser = _parser()
    args = parser.parse_args()
    _configure_logging(args)

    host_info = _get_host_info(args)
    service_id = _register(host_info, args)


def _configure_logging(args):
    """
    Configures the logger of the app
    """
    # todo make it configurable
    _log.setLevel(logging.DEBUG)

    # create console handler and set level to debug
    ch = logging.StreamHandler()
    ch.setLevel(logging.DEBUG)

    # create formatter
    formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')

    # add formatter to ch
    ch.setFormatter(formatter)

    # add ch to logger
    _log.addHandler(ch)



def _register(host_info, args):
    if args.registrar_addr:
        registrar_addr = args.registrar_addr
    else:
        registrar_addr = os.environ.get(REGISTRAR_ADDR)

    if not registrar_addr:
        _log.error("Could not find registrar address, quitting without registration.\n"
                   f"Set {REGISTRAR_ADDR} or use the -s/--service command line arg")
        return

    addr = registrar_addr
    if addr[-1:] != "/":
        addr += "/"
    requests.post(registrar_addr+"/")

def _host_file_name(args):
    if args.output_file:
        return args.output_file
    else:
        return os.environ.get("SERVICEGRAPH-HOST-FILE", "~/.servicegraph-host.json")

def _get_host_file_info(args):
    """
    gets the existing host info from the file
    """

    host_file_name = _host_file_name(args)
    host_info = {}
    if Path.exists(host_file_name):
        try:
            with open(host_file_name, 'r') as f:
                host_info = json.load(f)
        except Exception as e:
            _log.error(f"Could not read host file information from {host_file_name}", exc_info=e)
    return host_info


def _save_host_file_info(args, host_info):
    host_file_name= _host_file_name(args)
    try:
        with open(host_file_name, "w") as f:
            json.dump(f, host_info)
    except Exception as e :
        _log.error(f"Could not save the host file information to {host_file_name}", exc_info=e)

def _get_host_info(args):
    host_info = {
        "hostname": socket.gethostname(),
        "ip": extract_ip()
    }

    if args.host_description:
        host_info["description"]=args.host_description
    if args.host_type:
        host_info["type"] = args.host_type



def _parser():
    parser = argparse.ArgumentParser(description="Register host with service graph")
    parser.add_argument("-s", "--service", action="store", dest="registrar_addr", help="the address of the service graph registrar")
    parser.add_argument("-t", "--type", action="store", dest="host_type", help="the host type")
    parser.add_argument("-d", "--description", action="store", dest="host_description", help="the host description")
    parser.add_argument("-o", "--out", action="store", dest="output_file", help="the host registrar file name")
    return parser



def extract_ip():
    st = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        # RaduW. not sure why we need to do that (but we do).
        st.connect(('10.255.255.255', 1))
        ip = st.getsockname()[0]
    except Exception:
        ip = '127.0.0.1'
    finally:
        st.close()
    return ip


if __name__ == '__main__':
    main()
