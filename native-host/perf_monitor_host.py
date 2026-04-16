#!/usr/bin/env python3
"""
Native messaging host for Extension Perf Monitor.
Reads Chrome process data from OS and returns per-extension CPU% and RSS.
Protocol: Chrome Native Messaging (32-bit LE length prefix + UTF-8 JSON).
"""

import json
import platform
import struct
import subprocess
import sys
import re

VERSION = "1.0.0"


def read_message():
    raw_length = sys.stdin.buffer.read(4)
    if len(raw_length) < 4:
        return None
    length = struct.unpack('<I', raw_length)[0]
    data = sys.stdin.buffer.read(length)
    if len(data) < length:
        return None
    return json.loads(data.decode('utf-8'))


def write_message(obj):
    data = json.dumps(obj).encode('utf-8')
    sys.stdout.buffer.write(struct.pack('<I', len(data)))
    sys.stdout.buffer.write(data)
    sys.stdout.buffer.flush()


def sample_chrome_processes():
    os_name = platform.system()
    extensions = []
    try:
        if os_name in ('Darwin', 'Linux'):
            out = subprocess.check_output(
                ['ps', '-eo', 'pid,%cpu,rss,command'],
                text=True, timeout=5
            )
            for line in out.strip().split('\n')[1:]:
                parts = line.strip().split(None, 3)
                if len(parts) < 4:
                    continue
                pid_str, cpu_str, rss_str, cmd = parts
                if '--extension-process' not in cmd:
                    continue
                try:
                    pid = int(pid_str)
                    cpu = float(cpu_str)
                    rss = int(rss_str) * 1024
                except ValueError:
                    continue
                ext_id = None
                match = re.search(r'chrome-extension://([a-z]{32})', cmd)
                if match:
                    ext_id = match.group(1)
                extensions.append({
                    'extId': ext_id,
                    'pid': pid,
                    'cpu': round(cpu, 2),
                    'rss': rss,
                })
        elif os_name == 'Windows':
            out = subprocess.check_output(
                ['wmic', 'process', 'where',
                 "name like '%chrome%'",
                 'get', 'ProcessId,CommandLine,WorkingSetSize',
                 '/format:csv'],
                text=True, timeout=10
            )
            for line in out.strip().split('\n')[1:]:
                cols = line.strip().split(',')
                if len(cols) < 4:
                    continue
                cmd = cols[1]
                if '--extension-process' not in cmd:
                    continue
                try:
                    pid = int(cols[2])
                    rss = int(cols[3])
                except (ValueError, IndexError):
                    continue
                ext_id = None
                match = re.search(r'chrome-extension://([a-z]{32})', cmd)
                if match:
                    ext_id = match.group(1)
                extensions.append({
                    'extId': ext_id,
                    'pid': pid,
                    'cpu': 0.0,
                    'rss': rss,
                })
    except (subprocess.TimeoutExpired, FileNotFoundError, subprocess.CalledProcessError):
        pass
    return extensions


def handle_message(msg):
    msg_type = msg.get('type', '')
    if msg_type == 'hello':
        return {'type': 'hello', 'version': VERSION, 'platform': platform.system()}
    elif msg_type == 'sample':
        return {'type': 'sample', 'extensions': sample_chrome_processes()}
    else:
        return {'type': 'error', 'message': f'Unknown message type: {msg_type}'}


def main():
    while True:
        msg = read_message()
        if msg is None:
            break
        response = handle_message(msg)
        write_message(response)


if __name__ == '__main__':
    main()
