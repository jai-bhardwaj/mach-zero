# Mach-Zero Performance Tuning Guide

## Linux Kernel Tuning

### CPU Isolation
Isolate cores for the trading hot path to prevent OS scheduler interference:
```bash
# /etc/default/grub
GRUB_CMDLINE_LINUX="isolcpus=2,3,4,5 nohz_full=2,3,4,5 rcu_nocbs=2,3,4,5"
```

Recommended core assignment:
- Core 0: OS + interrupts
- Core 1: Aeron Media Driver
- Core 2: Market Data Gateway
- Core 3: Strategy Engine
- Core 4: Risk Engine
- Core 5: Order Entry Gateway

### Huge Pages
Pre-allocate 2MB huge pages for order book and risk state:
```bash
echo 512 > /proc/sys/vm/nr_hugepages
# Or in /etc/sysctl.conf:
vm.nr_hugepages = 512
```

### NUMA
Pin processes to the NUMA node closest to the NIC:
```bash
numactl --cpunodebind=0 --membind=0 ./strategy_engine
```

### Network Tuning
```bash
# Reduce network latency
sysctl -w net.core.busy_read=50
sysctl -w net.core.busy_poll=50
sysctl -w net.ipv4.tcp_low_latency=1

# Increase socket buffers
sysctl -w net.core.rmem_max=16777216
sysctl -w net.core.wmem_max=16777216
```

### IRQ Affinity
Pin NIC interrupts to Core 0 to keep trading cores clean:
```bash
echo 1 > /proc/irq/<NIC_IRQ>/smp_affinity
```

## Aeron Media Driver
- Use DEDICATED threading mode (see `aeron_config.properties`)
- Pin driver thread to its own isolated core
- Use `/dev/shm` for shared memory (tmpfs, memory-backed)
- Pre-touch mapped memory to avoid page faults

## Build Optimization
```bash
cmake -B build -DCMAKE_BUILD_TYPE=Release \
  -DCMAKE_CXX_FLAGS="-O3 -march=native -flto -DNDEBUG"
```

## Monitoring
- Check p99 latencies via risk monitor dashboard (port 8080)
- Monitor `/proc/<pid>/status` for context switches (voluntary_ctxt_switches)
- Use `perf stat` for cache miss and branch prediction analysis
